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
  return { format:'vegalaunch-vega-build-input-v1',projectId:`ch_${hex(digit)}`,
    creatorAccountId:`cr_${hex(digit)}`,specRevision:1,generatorFingerprint:'a'.repeat(64),
    sourceRevision:1,deploymentId:`dep_${hex(digit)}`,packageId:`com.example.creator${digit}`,
    manifestEndpoint:`https://example.test/public/v1/deployments/dep_${hex(digit)}/current`,
    publishedRelease:{ releaseId:`rel_${hex(digit)}`,sequence:1 },files:{},fileSha256:{},
    sourceHash:'b'.repeat(64),fingerprint:digit.repeat(64) };
}

test('real PostgreSQL queue serializes claims, reclaims leases and enforces owner actions',
  { skip: !available && 'PostgreSQL initdb unavailable' }, async () => {
    const root = await mkdtemp(join(tmpdir(),'vegalaunch-build-queue-'));
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
        await pool.query('CREATE TABLE channel_projects(id text,creator_account_id text,revision integer)');
        await pool.query('CREATE TABLE channel_deployments(id text,project_id text,creator_account_id text,package_id text,deployment jsonb)');
        await pool.query('CREATE TABLE publication_live_pointers(deployment_id text,project_id text,creator_account_id text,release_id text,sequence integer)');
        await pool.query('CREATE TABLE publication_releases(id text,deployment_id text,project_id text,creator_account_id text,approval_id text)');
        await pool.query('CREATE TABLE publication_approvals(id text,deployment_id text,project_id text,creator_account_id text,channel_revision integer)');
        const ddl = await readFile(new URL('../migrations/build_queue_001.sql',import.meta.url),'utf8');
        await pool.query(ddl);
        await pool.query(ddl);
        await pool.query(`CREATE ROLE build_api LOGIN; CREATE ROLE build_worker LOGIN;
          GRANT SELECT ON channel_deployments,channel_ownerships,channel_projects,publication_live_pointers,
            publication_releases,publication_approvals TO build_api;
          GRANT USAGE ON SCHEMA vegalaunch_build TO build_api,build_worker;
          GRANT SELECT,INSERT,UPDATE ON vegalaunch_build.jobs TO build_api;
          GRANT SELECT ON vegalaunch_build.jobs TO build_worker;
          GRANT UPDATE (state,attempt,lease_token,lease_until,heartbeat_at,updated_at,error_code,
            artifact_name,artifact_sha256,artifact_bytes,evidence) ON vegalaunch_build.jobs TO build_worker`);
        const apiPool = new Pool({ host:socket,port:54329,database:'postgres',user:'build_api',max:4 });
        const workerPool = new Pool({ host:socket,port:54329,database:'postgres',user:'build_worker',max:4 });
        const queue = new NativeBuildQueue(apiPool);
        const worker = new NativeBuildQueue(workerPool);
        try {
        await assert.rejects(workerPool.query('SELECT * FROM channel_deployments'), /permission denied/);
        await assert.rejects(workerPool.query('INSERT INTO vegalaunch_build.jobs(id) VALUES ($1)', ['job_'+'a'.repeat(32)]), /permission denied/);
        for (const digit of ['1','2']) {
          const owned = input(digit);
          await pool.query('INSERT INTO channel_ownerships VALUES($1,$2)',[owned.projectId,owned.creatorAccountId]);
          await pool.query('INSERT INTO channel_projects VALUES($1,$2,$3)',
            [owned.projectId,owned.creatorAccountId,owned.specRevision]);
          await pool.query('INSERT INTO channel_deployments VALUES($1,$2,$3,$4,$5)',
            [owned.deploymentId,owned.projectId,owned.creatorAccountId,owned.packageId,
              { nativeReleaseApproval:'creator_approved' }]);
          await pool.query('INSERT INTO publication_live_pointers VALUES($1,$2,$3,$4,$5)',
            [owned.deploymentId,owned.projectId,owned.creatorAccountId,owned.publishedRelease.releaseId,
              owned.publishedRelease.sequence]);
          await pool.query('INSERT INTO publication_releases VALUES($1,$2,$3,$4,$5)',
            [owned.publishedRelease.releaseId,owned.deploymentId,owned.projectId,owned.creatorAccountId,`ap_${hex(digit)}`]);
          await pool.query('INSERT INTO publication_approvals VALUES($1,$2,$3,$4,$5)',
            [`ap_${hex(digit)}`,owned.deploymentId,owned.projectId,owned.creatorAccountId,owned.specRevision]);
          assert.equal(await queue.enqueue(owned),await queue.enqueue(owned));
        }
        const draftDdl = await readFile(new URL('../migrations/build_queue_002.up.sql',import.meta.url),'utf8');
        await pool.query(draftDdl);
        const migrated = await pool.query("SELECT count(*)::int AS count FROM vegalaunch_build.jobs WHERE build_kind='published' AND release_id IS NOT NULL");
        assert.equal(migrated.rows[0].count,2,'existing published receipts survive additive migration');
        await assert.rejects(queue.enqueue(input('3')), /changed/);
        const { publishedRelease: _unused, ...draftBase } = input('3');
        const draft: ReleaseBuildInput = { ...draftBase, mode: 'draft',
          draft: { revision: 1, snapshotSha256: 'e'.repeat(64) } };
        await pool.query('INSERT INTO channel_ownerships VALUES($1,$2)',[draft.projectId,draft.creatorAccountId]);
        await pool.query('INSERT INTO channel_projects VALUES($1,$2,$3)',
          [draft.projectId,draft.creatorAccountId,draft.specRevision]);
        await pool.query('INSERT INTO channel_deployments VALUES($1,$2,$3,$4,$5)',
          [draft.deploymentId,draft.projectId,draft.creatorAccountId,draft.packageId,
            { nativeReleaseApproval:'pending_creator' }]);
        const draftJob = await queue.enqueue(draft);
        const draftRow = await pool.query('SELECT build_kind,release_id,release_sequence,draft_revision,draft_snapshot_sha256 FROM vegalaunch_build.jobs WHERE id=$1',[draftJob]);
        assert.deepEqual(draftRow.rows[0], { build_kind:'draft',release_id:null,release_sequence:null,
          draft_revision:1,draft_snapshot_sha256:'e'.repeat(64) });
        assert.equal(await queue.enqueue(draft,true),draftJob,'an active draft build remains idempotent');
        await pool.query(`UPDATE vegalaunch_build.jobs SET state='ready',artifact_name=id||'.vpkg',
          artifact_sha256=$2,artifact_bytes=2048,evidence='{}'::jsonb WHERE id=$1`,[draftJob,'a'.repeat(64)]);
        const rebuiltDraft = await queue.enqueue(draft,true);
        assert.notEqual(rebuiltDraft,draftJob,'a second creator click queues a fresh completed draft');
        assert.equal((await queue.status(draft.creatorAccountId,draft.projectId,draftJob))?.state,'canceled');
        await queue.acknowledgeArtifactRemoval(draftJob,`${draftJob}.vpkg`);
        assert.equal((await queue.latestStatus(input('1').creatorAccountId,input('1').projectId))?.state,'queued');
        assert.equal(await queue.latestStatus(input('2').creatorAccountId,input('1').projectId),null);
        await assert.rejects(queue.enqueue({ ...input('1'),fingerprint:'e'.repeat(64) }),
          /different source/);
        const [first,second] = await Promise.all([worker.claim(),worker.claim()]);
        assert.equal([first,second].filter(Boolean).length,1,'one global running job');
        const lease = first ?? second!;
        assert.equal(JSON.stringify(lease.input),JSON.stringify(input('1')),'snapshot property order retained');
        assert.equal(await queue.status(input('2').creatorAccountId,input('2').projectId,lease.jobId),null);
        assert.equal((await queue.status(input('1').creatorAccountId,input('1').projectId,lease.jobId))?.state,'running');
        assert.equal(await worker.heartbeat(lease.jobId,lease.leaseToken),true);
        assert.equal(await worker.heartbeat(lease.jobId,'0'.repeat(64)),false);
        assert.equal(await queue.cancel(input('2').creatorAccountId,input('2').projectId,lease.jobId),false);
        await pool.query("UPDATE vegalaunch_build.jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[lease.jobId]);
        const recovered = await worker.claim();
        assert.equal(recovered?.jobId,lease.jobId);
        assert.equal(recovered?.attempt,2);
        assert.equal(await worker.heartbeat(lease.jobId,lease.leaseToken),false);
        assert.equal(await worker.fail(recovered!.jobId,recovered!.leaseToken,'SANDBOX_FAILED'),true);
        assert.equal(await queue.retry(input('2').creatorAccountId,input('2').projectId,recovered!.jobId),false);
        assert.equal(await queue.retry(input('1').creatorAccountId,input('1').projectId,recovered!.jobId),true);
        const third = await worker.claim();
        assert.equal(third?.attempt,3);
        assert.equal(await queue.cancel(input('1').creatorAccountId,input('1').projectId,third!.jobId),true);
        assert.equal(await worker.heartbeat(third!.jobId,third!.leaseToken),false);
        await pool.query('UPDATE publication_live_pointers SET release_id=$2 WHERE project_id=$1',
          [input('1').projectId,`rel_${hex('9')}`]);
        await assert.rejects(queue.enqueue(input('1')), /published release changed/);
        const secondOwner = (await worker.claim())!;
        assert.equal(secondOwner.input.creatorAccountId,input('2').creatorAccountId);
        const evidence = { inputFingerprint:secondOwner.input.fingerprint,sourceHash:secondOwner.input.sourceHash,
          command:['./node_modules/.bin/react-native','build-vega','--target','x86_64','--build-type','Release'],
          target:'x86_64' as const,buildType:'Release' as const,
          toolchain:{ node:'v24.21.0',npm:'12.2.0',vegaCli:'1.4.4',vegaSdk:'0.24.12112' },
          dependencyLockSha256:'c'.repeat(64),artifactPath:'build/x86_64/Release/example_x86_64.vpkg',
          bytes:2048,sha256:'d'.repeat(64),deploymentId:secondOwner.input.deploymentId,
          packageId:secondOwner.input.packageId,publishedRelease:secondOwner.input.publishedRelease,
          inspectedPackageId:secondOwner.input.packageId };
        assert.equal(await worker.complete(secondOwner.jobId,secondOwner.leaseToken,
          { ...evidence, inputFingerprint:'f'.repeat(64) }),false,'stale fingerprint denied');
        assert.equal(await worker.complete(secondOwner.jobId,secondOwner.leaseToken,
          { ...evidence, packageId:'com.example.foreign' }),false,'foreign package denied');
        assert.equal(await worker.complete(secondOwner.jobId,secondOwner.leaseToken,evidence),true);
        assert.equal((await queue.status(input('2').creatorAccountId,input('2').projectId,secondOwner.jobId))?.artifactSha256,evidence.sha256);
        assert.equal(await queue.cancel(input('1').creatorAccountId,input('1').projectId,secondOwner.jobId),false);
        const changed = { ...input('2'),fingerprint:'e'.repeat(64) };
        const replacementId = await queue.enqueue(changed);
        assert.notEqual(replacementId,secondOwner.jobId);
        assert.equal(await queue.enqueue(changed),replacementId,'matching source is idempotent');
        assert.equal((await queue.status(input('2').creatorAccountId,input('2').projectId,secondOwner.jobId))?.state,'canceled');
        assert.equal((await queue.status(input('2').creatorAccountId,input('2').projectId,replacementId))?.state,'queued');
        assert.equal(await queue.cancel(input('2').creatorAccountId,input('2').projectId,replacementId),true);
        assert.deepEqual(await worker.expiredArtifacts(),[{ jobId:secondOwner.jobId,name:`${secondOwner.jobId}.vpkg` }]);
        assert.equal(await worker.retainArtifact(secondOwner.jobId,`${secondOwner.jobId}.vpkg`),false);
        await worker.acknowledgeArtifactRemoval(secondOwner.jobId,`${secondOwner.jobId}.vpkg`);
        assert.deepEqual(await worker.expiredArtifacts(),[]);
        await pool.query(`UPDATE vegalaunch_build.jobs SET created_at=now()-interval '2 days',
          expires_at=now()-interval '1 day' WHERE id=$1`,[replacementId]);
        assert.equal((await queue.status(input('2').creatorAccountId,input('2').projectId,replacementId))?.state,'expired');
        const migration = await pool.query("SELECT to_regclass('public.vegalaunch_schema_migrations') AS core");
        assert.equal(migration.rows[0].core,null,'queue never creates or bumps core migration');
        } finally { await apiPool.end(); await workerPool.end(); }
      } finally { await pool.end(); }
    } finally {
      if (started) execFileSync(join(bin,'pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{ stdio:'ignore' });
      await rm(root,{ recursive:true,force:true });
    }
  });
