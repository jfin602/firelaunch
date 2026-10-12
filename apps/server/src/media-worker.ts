import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { MediaRenditionSet } from '@firelaunch/contracts';
import type { S3MediaStorage } from './media-storage.js';
import type { MediaWorkerRepository, WorkerClaim } from './media-worker-repository.js';

const FFMPEG = '/usr/bin/ffmpeg';
const FFPROBE = '/usr/bin/ffprobe';
const PRLIMIT = '/usr/bin/prlimit';
const profile = 'hls-avc-aac-v1' as const;
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const maxOutput = 512 * 1024 * 1024;
const segmentName = /^v(480|720)-\d{3,5}\.ts$/;
const playlistName = /^v(480|720)\.m3u8$/;

export class WorkerFailure extends Error {
  constructor(readonly code: 'probe_failed' | 'encode_failed' | 'verification_failed' | 'worker_timeout', message: string) {
    super(message);
  }
}

/** No command, URL, pathname or codec option is accepted from a tenant. */
export async function runTool(tool: 'ffmpeg' | 'ffprobe', args: readonly string[], timeoutMs: number,
  signal?: AbortSignal, outputDir?: string): Promise<string> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) throw new Error('Invalid tool timeout');
  if (signal?.aborted) throw new WorkerFailure('worker_timeout','Media tool cancelled');
  const binary = tool === 'ffmpeg' ? FFMPEG : FFPROBE;
  const child = spawn(PRLIMIT, ['--cpu=600', '--as=4294967296', '--fsize=67108864', '--nofile=128',
    '--', binary, ...args], { shell: false, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', HOME: '/nonexistent' } });
  let output = '';
  let errorOutput = '';
  let timedOut = false;
  let diskExceeded = false;
  const kill = () => { if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } } };
  const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
  const diskTimer = outputDir ? setInterval(() => { void (async () => {
    const names = await readdir(outputDir);
    const sizes = await Promise.all(names.filter(name => name !== 'source.mp4').map(name => stat(path.join(outputDir,name))));
    if (sizes.reduce((sum,file) => sum+file.size,0) > maxOutput) { diskExceeded = true; kill(); }
  })().catch(() => { diskExceeded = true; kill(); }); },1000) : undefined;
  signal?.addEventListener('abort', kill, { once: true });
  try {
    const code = await new Promise<number>((resolve, reject) => {
      child.on('error', reject);
      child.stdout.on('data', (data: Buffer) => { output += data.toString(); if (output.length > 2_000_000) kill(); });
      child.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); if (errorOutput.length > 2_000_000) kill(); });
      child.on('close', value => resolve(value ?? -1));
    });
    if (timedOut || signal?.aborted) throw new WorkerFailure('worker_timeout', 'Media tool timed out or was cancelled');
    if (diskExceeded) throw new WorkerFailure('encode_failed','Worker output disk limit exceeded');
    if (code !== 0 || output.length > 2_000_000 || errorOutput.length > 2_000_000)
      throw new Error(`${tool} exited unsuccessfully`);
    return output;
  } finally { clearTimeout(timer); if (diskTimer) clearInterval(diskTimer); signal?.removeEventListener('abort', kill); }
}

type Probe = { format?: { format_name?: string; duration?: string; start_time?: string };
  streams?: Array<{ codec_type?: string; codec_name?: string; profile?: string; pix_fmt?: string;
    width?: number; height?: number; avg_frame_rate?: string; sample_rate?: string; channels?: number;
    start_time?: string }> };

export type SourcePlan = Readonly<{ mode: 'remux' | 'encode'; heights: readonly (480 | 720)[];
  fps: number; duration: number; width: number; sourceHeight: number }>;

export function chooseSourcePlan(probe: Probe, keyframes: readonly number[]): SourcePlan {
  const video = probe.streams?.filter(s => s.codec_type === 'video');
  const audio = probe.streams?.filter(s => s.codec_type === 'audio');
  const duration = Number(probe.format?.duration);
  if (!probe.format?.format_name?.split(',').includes('mov') &&
      !probe.format?.format_name?.split(',').includes('mp4')) throw new WorkerFailure('probe_failed', 'MP4 required');
  if (video?.length !== 1 || audio?.length !== 1 || !Number.isFinite(duration) || duration <= 0 || duration > 600)
    throw new WorkerFailure('probe_failed', 'Invalid stream count or duration');
  const v = video[0]!; const a = audio[0]!;
  const [n, d] = (v.avg_frame_rate ?? '').split('/').map(Number);
  const fps = n! / d!;
  if (!Number.isFinite(fps) || fps < 1 || fps > 60 || !Number.isInteger(v.width) || !Number.isInteger(v.height) ||
    v.width! < 2 || v.width! > 4096 || v.height! < 480 || v.height! > 2160 ||
    v.width! % 2 !== 0 || v.height! % 2 !== 0 ||
    !Number.isFinite(Number(probe.format?.start_time)) || Math.abs(Number(probe.format?.start_time)) > 0.1 ||
    !Number.isFinite(Number(v.start_time ?? '0')) || Math.abs(Number(v.start_time ?? '0')) > 0.1 ||
    a.codec_name !== 'aac' && a.codec_name !== 'mp3' && a.codec_name !== 'ac3' && a.codec_name !== 'pcm_s16le')
    throw new WorkerFailure('probe_failed', 'Unsupported source dimensions, timing or streams');
  const compatible = v.codec_name === 'h264' && ['Baseline', 'Constrained Baseline', 'Main', 'High'].includes(v.profile ?? '') &&
    v.pix_fmt === 'yuv420p' && a.codec_name === 'aac' && a.profile === 'LC' &&
    a.channels !== undefined && a.channels <= 2 && Number(a.sample_rate) >= 32000;
  const aligned = keyframes.length > 0 && Math.abs(keyframes[0]!) < 0.1 &&
    keyframes.every((value, index) => index === 0 ||
      value > keyframes[index - 1]! && value - keyframes[index - 1]! >= 5.5 && value - keyframes[index - 1]! <= 6.3);
  return { mode: compatible && aligned && v.height === 480 ? 'remux' : 'encode',
    heights: v.height! >= 720 ? [480, 720] : [480], fps, duration,
    width: v.width!, sourceHeight: v.height! };
}

async function probeSource(input: string, signal?: AbortSignal): Promise<SourcePlan> {
  let info: Probe;
  let frames: { frames?: Array<{ best_effort_timestamp_time?: string }> };
  try {
    info = JSON.parse(await runTool('ffprobe', ['-v','error','-protocol_whitelist','file','-show_entries',
      'format=format_name,duration,start_time:stream=codec_type,codec_name,profile,pix_fmt,width,height,avg_frame_rate,sample_rate,channels,start_time',
      '-of','json',input], 15_000, signal));
    frames = JSON.parse(await runTool('ffprobe', ['-v','error','-protocol_whitelist','file','-select_streams','v:0',
      '-skip_frame','nokey','-show_frames','-show_entries','frame=best_effort_timestamp_time',
      '-of','json',input], 30_000, signal));
  } catch (error) { if (error instanceof WorkerFailure) throw error;
    throw new WorkerFailure('probe_failed', 'Source probe failed'); }
  const keyframes = frames.frames?.map(frame => Number(frame.best_effort_timestamp_time));
  if (!keyframes || keyframes.length > 400 || keyframes.some(value => !Number.isFinite(value)))
    throw new WorkerFailure('probe_failed', 'Invalid keyframe timestamps');
  return chooseSourcePlan(info, keyframes);
}

async function encodeVariant(input: string, dir: string, height: 480 | 720, plan: SourcePlan,
  signal?: AbortSignal): Promise<void> {
  const fpsGop = Math.max(6, Math.round(plan.fps * 6));
  const name = `v${height}`;
  const args = ['-hide_banner','-loglevel','error','-nostdin','-y','-protocol_whitelist','file',
    '-i',input,'-map','0:v:0','-map','0:a:0','-sn','-dn'];
  if (plan.mode === 'remux') args.push('-c:v','copy','-c:a','copy');
  else args.push('-vf',`scale=-2:${height}:flags=lanczos,format=yuv420p`, '-c:v','libx264',
    '-preset','veryfast','-profile:v','main','-level','3.1','-threads','2','-filter_threads','2',
    '-g',String(fpsGop),'-keyint_min',String(fpsGop),'-sc_threshold','0',
    '-force_key_frames','expr:gte(t,n_forced*6)', '-b:v',height === 720 ? '2800k' : '1200k',
    '-maxrate',height === 720 ? '3000k' : '1400k','-bufsize',height === 720 ? '6000k' : '2800k',
    '-c:a','aac','-profile:a','aac_low','-ac','2','-b:a','128k');
  args.push('-f','hls','-hls_time','6','-hls_playlist_type','vod','-hls_flags','independent_segments',
    '-hls_segment_type','mpegts','-hls_segment_filename',path.join(dir,`${name}-%03d.ts`),
    path.join(dir,`${name}.m3u8`));
  try { await runTool('ffmpeg', args, 300_000, signal, dir); }
  catch (error) { if (error instanceof WorkerFailure) throw error;
    throw new WorkerFailure('encode_failed', 'HLS conversion failed'); }
}

type VerifiedFile = { name: string; body: Buffer; sha256: string; mime: string };
export async function verifyHls(dir: string, heights: readonly (480 | 720)[], duration: number,
  signal?: AbortSignal): Promise<{ files: VerifiedFile[]; variants: MediaRenditionSet['variants'] }> {
  const names = await readdir(dir);
  if (names.length > 502 || names.some(name => name !== 'source.mp4' && name !== 'master.m3u8' &&
    !playlistName.test(name) && !segmentName.test(name)))
    throw new WorkerFailure('verification_failed', 'Unexpected HLS output');
  if ((await Promise.all(names.map(name => lstat(path.join(dir,name))))).some(file => !file.isFile() || file.isSymbolicLink()))
    throw new WorkerFailure('verification_failed', 'Unsafe HLS output type');
  const masterInfo = await lstat(path.join(dir,'master.m3u8'));
  if (masterInfo.size < 1 || masterInfo.size > 64 * 1024 * 1024)
    throw new WorkerFailure('verification_failed','Invalid master size');
  const master = (await readFile(path.join(dir,'master.m3u8'))).toString();
  if (!master.startsWith('#EXTM3U\n') || master.includes('#EXT-X-KEY') ||
    heights.some(h => !master.includes(`v${h}.m3u8`)) ||
    [...master.matchAll(/^(v\d+\.m3u8)$/gm)].length !== heights.length ||
    master.split('\n').filter(line => line && !line.startsWith('#')).some(line => !playlistName.test(line)))
    throw new WorkerFailure('verification_failed', 'Invalid master graph');
  const files: VerifiedFile[] = [];
  const add = async (name: string) => {
    const info = await lstat(path.join(dir,name));
    if (!info.isFile() || info.isSymbolicLink() || info.size < 1 || info.size > 64 * 1024 * 1024)
      throw new WorkerFailure('verification_failed', 'HLS object size or type invalid');
    const body = await readFile(path.join(dir,name));
    if (!body.length || body.length > 64 * 1024 * 1024) throw new WorkerFailure('verification_failed', 'HLS object size invalid');
    files.push({ name, body, sha256: sha(body), mime: name.endsWith('.m3u8') ?
      'application/vnd.apple.mpegurl' : 'video/mp2t' });
  };
  await add('master.m3u8');
  const variants: MediaRenditionSet['variants'] = [];
  let reference: number[] | undefined;
  for (const height of heights) {
    const playlist = `v${height}.m3u8`;
    const playlistInfo = await lstat(path.join(dir,playlist));
    if (!playlistInfo.isFile() || playlistInfo.isSymbolicLink() || playlistInfo.size < 1 ||
      playlistInfo.size > 64 * 1024 * 1024) throw new WorkerFailure('verification_failed','Invalid playlist size');
    const body = (await readFile(path.join(dir,playlist))).toString();
    if (!body.startsWith('#EXTM3U\n') || !body.includes('#EXT-X-ENDLIST') ||
      !body.includes('#EXT-X-INDEPENDENT-SEGMENTS') || body.includes('#EXT-X-KEY') || body.includes('://'))
      throw new WorkerFailure('verification_failed', 'Invalid variant playlist');
    const segments = [...body.matchAll(/^v\d+-(\d{3,5})\.ts$/gm)].map(m => m[0]);
    const times = [...body.matchAll(/^#EXTINF:([0-9.]+),?$/gm)].map(m => Number(m[1]));
    if (!segments.length || segments.length !== times.length || segments.length > 250 ||
      body.split('\n').filter(line => line && !line.startsWith('#')).some(line => !segmentName.test(line)) ||
      segments.some((name,index) => name !== `v${height}-${String(index).padStart(3,'0')}.ts`) ||
      times.some(t => !Number.isFinite(t) || t <= 0 || t > 7) ||
      Math.abs(times.reduce((a,b) => a+b,0)-duration) > 1.5 ||
      reference && (times.length !== reference.length ||
        times.some((time,index) => Math.abs(time-reference![index]!) > 0.12)))
      throw new WorkerFailure('verification_failed', 'HLS segments missing or misaligned');
    reference ??= times;
    await add(playlist);
    for (const segment of segments) await add(segment);
    const hashes = segments.map(name => files.find(file => file.name === name)!.sha256).join('');
    variants.push({ height, playlistKey: playlist, playlistSha256: files.find(file => file.name === playlist)!.sha256,
      segmentsSha256: sha(Buffer.from(hashes)), segmentCount: segments.length });
    try { await runTool('ffmpeg', ['-hide_banner','-loglevel','error','-nostdin','-protocol_whitelist','file',
      '-ss',String(Math.min(duration / 2, 1)),'-i',path.join(dir,playlist),'-frames:v','1','-f','null','-'],
    15_000, signal); } catch { throw new WorkerFailure('verification_failed', 'HLS seek failed'); }
  }
  if (files.reduce((sum,file) => sum+file.body.length,0) > maxOutput ||
    names.length !== files.length + 1) throw new WorkerFailure('verification_failed', 'HLS graph incomplete or oversized');
  return { files, variants };
}

export async function runOneMediaJob(repo: MediaWorkerRepository, storage: S3MediaStorage,
  signal?: AbortSignal): Promise<'idle' | 'ready' | 'failed'> {
  const claim = await repo.claim();
  if (!claim) return 'idle';
  process.stdout.write(`media worker: job ${claim.jobId} attempt ${claim.attempts}/3\n`);
  const dir = await mkdtemp(path.join(os.tmpdir(),'firelaunch-hls-'));
  let alive = true;
  const work = new AbortController();
  const cancel = () => work.abort();
  signal?.addEventListener('abort',cancel,{ once:true });
  const deadline = setTimeout(cancel,600_000);
  const heartbeat = setInterval(() => { void repo.renew(claim).then(ok => { if (!ok) { alive = false; cancel(); } })
    .catch(() => { alive = false; cancel(); }); },60_000);
  let failure: WorkerFailure['code'] = 'verification_failed';
  try {
    if (work.signal.aborted) throw new WorkerFailure('worker_timeout','Worker cancelled');
    if (!Number.isSafeInteger(claim.bytes) || claim.bytes < 1 || claim.bytes > 2_000_000_000 ||
      !/^[a-f0-9]{64}$/.test(claim.sha256)) throw new WorkerFailure('probe_failed','Invalid original metadata');
    await storage.downloadOriginal(claim.scope,claim.uploadId,{ bytes: claim.bytes, sha256: claim.sha256 },
      path.join(dir,'source.mp4'),work.signal);
    const plan = await probeSource(path.join(dir,'source.mp4'),work.signal);
    process.stdout.write(`media worker: ${claim.jobId} ${plan.mode} ${plan.heights.join(',')}p duration ${plan.duration}s\n`);
    for (const height of plan.heights) { await encodeVariant(path.join(dir,'source.mp4'),dir,height,plan,work.signal);
      if (!alive || work.signal.aborted) throw new WorkerFailure('worker_timeout','Lease lost or worker cancelled'); }
    const lines = ['#EXTM3U','#EXT-X-VERSION:3'];
    for (const height of plan.heights) lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${height === 720 ? 3200000 : 1500000},RESOLUTION=${Math.round(plan.width * height / plan.sourceHeight / 2) * 2}x${height}`,
      `v${height}.m3u8`);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path.join(dir,'master.m3u8'),`${lines.join('\n')}\n`,{ flag:'wx',mode:0o600 });
    const graph = await verifyHls(dir,plan.heights,plan.duration,work.signal);
    const setId = `rs_${randomUUID().replaceAll('-','')}`;
    for (const file of graph.files) {
      if (!alive || work.signal.aborted) throw new WorkerFailure('worker_timeout','Lease lost or worker cancelled');
      await storage.putStaged(claim.scope,setId,file.name,file.body,file.sha256);
    }
    const rendition: MediaRenditionSet = { id:setId, creatorAccountId:claim.scope.creatorAccountId,
      projectId:claim.scope.projectId,catalogItemId:claim.itemId,mediaAssetId:claim.scope.mediaAssetId,
      jobId:claim.jobId,profile,masterKey:storage.stagedKey(claim.scope,setId,'master.m3u8'),
      masterSha256:graph.files.find(file => file.name === 'master.m3u8')!.sha256,
      variants:graph.variants.map(v => ({ ...v,playlistKey:storage.stagedKey(claim.scope,setId,v.playlistKey) })),
      verifiedAt:new Date().toISOString() };
    if (!alive || !await repo.complete(claim,rendition)) throw new WorkerFailure('worker_timeout','Lease lost');
    process.stdout.write(`media worker: ${claim.jobId} READY ${setId}\n`);
    return 'ready';
  } catch (error) {
    failure = error instanceof WorkerFailure ? error.code : 'verification_failed';
    await repo.fail(claim,failure).catch(() => false);
    process.stdout.write(`media worker: ${claim.jobId} FAILED ${failure}\n`);
    return 'failed';
  } finally { clearInterval(heartbeat); clearTimeout(deadline); signal?.removeEventListener('abort',cancel);
    await rm(dir,{ recursive:true,force:true }); }
}
