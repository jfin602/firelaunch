import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Pool } from 'pg';
import { NativeBuildQueue } from '../src/native-build-queue.js';
import type { ReleaseBuildInput } from '../src/release-build.js';

const bin = '/usr/lib/postgresql/16/bin';
let available = true;
try { execFileSync(join(bin,'initdb'),['--version'],{ stdio:'ignore' }); }
catch { available = false; }
const hex = (digit: string) => digit.repeat(32);
function input(digit: string): ReleaseBuildInput {
  return { format:'firelaunch-vega-build-input-v1',projectId:`ch_${hex(digit)}`,
    creatorAccountId:`cr_${hex(digit)}`,specRevision:1,generatorFingerprint:'a'.repeat(64),
    sourceRevision:1,deploymentId:`dep_${hex(digit)}`,packageId:`com.example.creator${digit}`,
    manifestEndpoint:`https://example.test/public/v1/deployments/dep_${hex(digit)}/current`,
    publishedRelease:{ releaseId:`rel_${hex(digit)}`,sequence:1 },files:{},fileSha256:{},
    sourceHash:'b'.repeat(64),fingerprint:digit.repeat(64) };
}

test('real PostgreSQL queue serializes claims, reclaims leases and enforces owner actions',
  { skip: !available && 'PostgreSQL initdb unavailable' }, async () => {
    const root = await mkdtemp(join(tmpdir(),'firelaunch-build-queue-'));
    const data = join(root,'data');
    const socket = join(root,'socket');
    const fs = await import('node:fs/promises');
    await fs.mkdir(socket,{ mode:0o700 });
    let started = false;
    try {
      execFileSync(join(bin,'initdb'),['-D',data,'-A','trust','--no-instructions'],{ stdio:'ignore' });
      execFileSync(join(bin,'pg_ctl'),['-D',data,'-o',`-k ${socket} -c listen_addresses= -p 54329`,'-w','start'],{ stdio:'ignore' });
      started = true;
      const pool = new Pool({ host:socket,port:54329,database:'postgres',user:process.env.USER,max:8 });
      try {
        await pool.query('CREATE TABLE channel_ownerships(project_id text,creator_account_id text)');
        await pool.query('CREATE TABLE channel_deployments(id text,project_id text,creator_account_id text,package_id text)');
        const ddl = await readFile(new URL('../migrations/build_queue_001.sql',import.meta.url),'utf8');
        await pool.query(ddl);
        await pool.query(ddl);
        const queue = new NativeBuildQueue(pool);
        for (const digit of ['1','2']) {
          const owned = input(digit);
          await pool.query('INSERT INTO channel_ownerships VALUES($1,$2)',[owned.projectId,owned.creatorAccountId]);
          await pool.query('INSERT INTO channel_deployments VALUES($1,$2,$3,$4)',
            [owned.deploymentId,owned.projectId,owned.creatorAccountId,owned.packageId]);
          assert.equal(await queue.enqueue(owned),await queue.enqueue(owned));
        }
        await assert.rejects(queue.enqueue({ ...input('1'),fingerprint:'e'.repeat(64) }),
          /different source/);
        const [first,second] = await Promise.all([queue.claim(),queue.claim()]);
        assert.equal([first,second].filter(Boolean).length,1,'one global running job');
        const lease = first ?? second!;
        assert.equal(JSON.stringify(lease.input),JSON.stringify(input('1')),'snapshot property order retained');
        assert.equal(await queue.status(input('2').creatorAccountId,input('2').projectId,lease.jobId),null);
        assert.equal((await queue.status(input('1').creatorAccountId,input('1').projectId,lease.jobId))?.state,'running');
        assert.equal(await queue.heartbeat(lease.jobId,lease.leaseToken),true);
        assert.equal(await queue.heartbeat(lease.jobId,'0'.repeat(64)),false);
        assert.equal(await queue.cancel(input('2').creatorAccountId,input('2').projectId,lease.jobId),false);
        await pool.query("UPDATE firelaunch_build.jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[lease.jobId]);
        const recovered = await queue.claim();
        assert.equal(recovered?.jobId,lease.jobId);
        assert.equal(recovered?.attempt,2);
        assert.equal(await queue.heartbeat(lease.jobId,lease.leaseToken),false);
        assert.equal(await queue.fail(recovered!.jobId,recovered!.leaseToken,'SANDBOX_FAILED'),true);
        assert.equal(await queue.retry(input('2').creatorAccountId,input('2').projectId,recovered!.jobId),false);
        assert.equal(await queue.retry(input('1').creatorAccountId,input('1').projectId,recovered!.jobId),true);
        const third = await queue.claim();
        assert.equal(third?.attempt,3);
        assert.equal(await queue.cancel(input('1').creatorAccountId,input('1').projectId,third!.jobId),true);
        assert.equal(await queue.heartbeat(third!.jobId,third!.leaseToken),false);
        const secondOwner = (await queue.claim())!;
        assert.equal(secondOwner.input.creatorAccountId,input('2').creatorAccountId);
        const evidence = { inputFingerprint:secondOwner.input.fingerprint,sourceHash:secondOwner.input.sourceHash,
          command:['./node_modules/.bin/react-native','build-vega','--target','x86_64','--build-type','Release'],
          target:'x86_64' as const,buildType:'Release' as const,
          toolchain:{ node:'v24.21.0',npm:'12.2.0',vegaCli:'1.4.4',vegaSdk:'0.24.12112' },
          dependencyLockSha256:'c'.repeat(64),artifactPath:'build/x86_64/Release/example_x86_64.vpkg',
          bytes:2048,sha256:'d'.repeat(64),deploymentId:secondOwner.input.deploymentId,
          packageId:secondOwner.input.packageId,publishedRelease:secondOwner.input.publishedRelease,
          inspectedPackageId:secondOwner.input.packageId };
        assert.equal(await queue.complete(secondOwner.jobId,secondOwner.leaseToken,
          { ...evidence, inputFingerprint:'f'.repeat(64) }),false,'stale fingerprint denied');
        assert.equal(await queue.complete(secondOwner.jobId,secondOwner.leaseToken,
          { ...evidence, packageId:'com.example.foreign' }),false,'foreign package denied');
        assert.equal(await queue.complete(secondOwner.jobId,secondOwner.leaseToken,evidence),true);
        assert.equal((await queue.status(input('2').creatorAccountId,input('2').projectId,secondOwner.jobId))?.artifactSha256,evidence.sha256);
        assert.equal(await queue.cancel(input('1').creatorAccountId,input('1').projectId,secondOwner.jobId),false);
        assert.equal(await queue.cancel(input('2').creatorAccountId,input('2').projectId,secondOwner.jobId),true);
        assert.deepEqual(await queue.expiredArtifacts(),[{ jobId:secondOwner.jobId,name:`${secondOwner.jobId}.vpkg` }]);
        assert.equal(await queue.retainArtifact(secondOwner.jobId,`${secondOwner.jobId}.vpkg`),false);
        await queue.acknowledgeArtifactRemoval(secondOwner.jobId,`${secondOwner.jobId}.vpkg`);
        assert.deepEqual(await queue.expiredArtifacts(),[]);
        const migration = await pool.query("SELECT to_regclass('public.firelaunch_schema_migrations') AS core");
        assert.equal(migration.rows[0].core,null,'queue never creates or bumps core migration');
      } finally { await pool.end(); }
    } finally {
      if (started) execFileSync(join(bin,'pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{ stdio:'ignore' });
      await rm(root,{ recursive:true,force:true });
    }
  });
