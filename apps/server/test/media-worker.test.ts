import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { MediaRenditionSet } from '@firelaunch/contracts';
import { chooseSourcePlan, runOneMediaJob, runTool, verifyHls } from '../src/media-worker.js';
import type { MediaWorkerRepository, WorkerClaim } from '../src/media-worker-repository.js';
import type { S3MediaStorage } from '../src/media-storage.js';

const sha = (body: Buffer) => createHash('sha256').update(body).digest('hex');
const id = (prefix: string, digit: string) => `${prefix}_${digit.repeat(32)}`;
const claim = (body: Buffer): WorkerClaim => ({ jobId:id('job','a'),token:'eaa43f7a-a15f-44e1-b9bf-42c5425e68e0',
  attempts:1,scope:{ creatorAccountId:id('cr','b'),projectId:id('ch','c'),mediaAssetId:id('ma','d') },
  itemId:id('ci','e'),uploadId:id('up','f'),bytes:body.length,sha256:sha(body) });

test('fixed source decision requires codecs, safe keyframes and never upscales', () => {
  const probe = { format:{ format_name:'mov,mp4,m4a,3gp,3g2,mj2',duration:'12',start_time:'0' }, streams:[
    { codec_type:'video',codec_name:'h264',profile:'Main',pix_fmt:'yuv420p',width:854,height:480,
      avg_frame_rate:'2/1',start_time:'0' },
    { codec_type:'audio',codec_name:'aac',profile:'LC',channels:2,sample_rate:'44100' }] };
  assert.equal(chooseSourcePlan(probe,[0,6]).mode,'remux');
  assert.equal(chooseSourcePlan(probe,[0,5]).mode,'encode');
  assert.deepEqual(chooseSourcePlan({ ...probe,streams:[{ ...probe.streams[0],height:720 },probe.streams[1]!] },[0,6]).heights,
    [480,720]);
  assert.deepEqual(chooseSourcePlan({ ...probe,streams:[{ ...probe.streams[0],height:600 },probe.streams[1]!] },[0,6]).heights,
    [480]);
  assert.throws(() => chooseSourcePlan({ ...probe,streams:[{ ...probe.streams[0],height:360 },probe.streams[1]!] },[0,6]),
    /Unsupported/);
  assert.throws(() => chooseSourcePlan({ ...probe,format:{ ...probe.format,duration:'NaN' } },[0]), /Invalid/);
});

test('tool execution has a bounded timeout and cancellation', async () => {
  await assert.rejects(runTool('ffmpeg',['-f','lavfi','-i','testsrc2=size=320x240:rate=30','-re','-t','100',
    '-f','null','-'],30), /timed out/);
  const cancel = new AbortController(); cancel.abort();
  await assert.rejects(runTool('ffprobe',['-version'],1000,cancel.signal), /cancelled/);
});

test('tool argv cannot execute shell metacharacters', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'firelaunch-worker-argv-'));
  t.after(() => rm(dir,{ recursive:true,force:true }));
  const marker = path.join(dir,'injected');
  await assert.rejects(runTool('ffprobe',[`-version;touch ${marker}`],1000));
  await assert.rejects(stat(marker),/ENOENT/);
});

test('tiny video produces verified immutable HLS objects; failures retry without ready', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'firelaunch-worker-test-'));
  t.after(() => rm(dir,{ recursive:true,force:true }));
  const source = path.join(dir,'owned.mp4');
  const generated = spawnSync('/usr/bin/ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi',
    '-i','testsrc2=size=854x480:rate=2','-f','lavfi','-i','sine=frequency=1000:sample_rate=44100',
    '-t','12','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-g','12','-keyint_min','12',
    '-sc_threshold','0','-c:a','aac','-shortest',source],{ timeout:30_000 });
  assert.equal(generated.status,0,generated.stderr?.toString());
  const original = await readFile(source);
  const job = claim(original);
  const staged = new Map<string,Buffer>();
  let attempts = 0;
  let completed: MediaRenditionSet | undefined;
  let failure: string | undefined;
  let tamper = true;
  let stageFailure = false;
  const repo = { claim: async () => attempts++ < 2 ? job : null,
    renew: async () => true,
    fail: async (_claim: WorkerClaim,code: string) => { failure=code; return true; },
    complete: async (_claim: WorkerClaim,set: MediaRenditionSet) => { completed=set; return true; } } as unknown as MediaWorkerRepository;
  const storage = { downloadOriginal: async (_scope: unknown,_uploadId: string,expected: { bytes:number;sha256:string },destination:string) => {
      const body = tamper ? Buffer.from('malformed') : original;
      if (body.length !== expected.bytes || sha(body) !== expected.sha256) throw new Error('source checksum mismatch');
      await copyFile(source,destination);
    },
    stagedKey: (_scope: unknown,setId: string,name: string) => `media/${'b'.repeat(32)}/${'c'.repeat(32)}/${'d'.repeat(32)}/staged/${setId.slice(3)}/${name}`,
    putStaged: async (_scope: unknown,setId: string,name: string,body: Buffer,digest: string) => {
      assert.equal(sha(body),digest);
      if (stageFailure && name.endsWith('.ts')) throw new Error('partial S3 staging failure');
      staged.set(`${setId}/${name}`,body);
    } } as unknown as S3MediaStorage;
  assert.equal(await runOneMediaJob(repo,storage),'failed');
  assert.equal(failure,'verification_failed');
  assert.equal(completed,undefined);
  tamper=false;
  assert.equal(await runOneMediaJob(repo,storage),'ready');
  assert.ok(completed);
  assert.equal(completed.variants.length,1);
  assert.equal(completed.variants[0]?.height,480);
  assert.equal(completed.masterSha256,sha(staged.get(`${completed.id}/master.m3u8`)!));
  const firstHashes = [...staged].map(([key,body]) => [key.split('/')[1],sha(body)]).sort();
  attempts=1;
  staged.clear();
  assert.equal(await runOneMediaJob(repo,storage),'ready');
  assert.deepEqual([...staged].map(([key,body]) => [key.split('/')[1],sha(body)]).sort(),firstHashes,
    'same source and profile must produce identical HLS bytes');
  const graphDir = path.join(dir,'graph');
  const { mkdir } = await import('node:fs/promises'); await mkdir(graphDir);
  await writeFile(path.join(graphDir,'source.mp4'),original);
  for (const [key,body] of staged) await writeFile(path.join(graphDir,key.split('/')[1]!),body);
  assert.equal((await verifyHls(graphDir,[480],12)).files.length,staged.size);
  const firstSegment = [...staged.keys()].find(key => key.endsWith('.ts'))!.split('/')[1]!;
  await rm(path.join(graphDir,firstSegment));
  await assert.rejects(verifyHls(graphDir,[480],12));
  attempts=1;
  completed=undefined;
  stageFailure=true;
  assert.equal(await runOneMediaJob(repo,storage),'failed');
  assert.equal(failure,'verification_failed');
  assert.equal(completed,undefined,'partial staged graph must never be READY');
  stageFailure=false;
  assert.equal(await runOneMediaJob(repo,storage),'idle');
});

test('720p input re-encodes aligned 480p and 720p outputs', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'firelaunch-worker-720-'));
  t.after(() => rm(dir,{ recursive:true,force:true }));
  const source = path.join(dir,'owned.mp4');
  const generated = spawnSync('/usr/bin/ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi',
    '-i','testsrc2=size=1280x720:rate=2','-f','lavfi','-i','sine=frequency=1000:sample_rate=44100',
    '-t','7','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-shortest',source],
  { timeout:30_000 });
  assert.equal(generated.status,0,generated.stderr?.toString());
  const original = await readFile(source);
  const job = claim(original);
  const staged = new Map<string,Buffer>();
  let complete: MediaRenditionSet | undefined;
  const repo = { claim: async () => job, renew: async () => true, fail: async () => true,
    complete: async (_claim: WorkerClaim,set: MediaRenditionSet) => { complete=set; return true; } } as unknown as MediaWorkerRepository;
  const storage = { downloadOriginal: async (_scope: unknown,_id: string,_expected: unknown,dest: string) => copyFile(source,dest),
    stagedKey: (_scope: unknown,setId: string,name: string) => `media/${'b'.repeat(32)}/${'c'.repeat(32)}/${'d'.repeat(32)}/staged/${setId.slice(3)}/${name}`,
    putStaged: async (_scope: unknown,_setId: string,name: string,body: Buffer,digest: string) => {
      assert.equal(sha(body),digest); staged.set(name,body);
    } } as unknown as S3MediaStorage;
  assert.equal(await runOneMediaJob(repo,storage),'ready');
  assert.deepEqual(complete?.variants.map(v => v.height),[480,720]);
  assert.equal(staged.get('master.m3u8')?.toString().includes('v720.m3u8'),true);
  assert.ok(staged.has('v480-000.ts') && staged.has('v720-000.ts'));
});
