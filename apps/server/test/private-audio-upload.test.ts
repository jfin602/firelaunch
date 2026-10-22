import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { MAX_PRIVATE_AUDIO_BYTES } from '../src/private-objects.js';
import { privateAudioBody } from '../src/api.js';

function request(bytes: Buffer, contentType = 'audio/mpeg', declared = bytes.length): IncomingMessage {
  return Object.assign(Readable.from([bytes]), { headers: { 'content-type': contentType, 'content-length': String(declared) } }) as IncomingMessage;
}

test('large private MP3 ingress streams to a temporary file and verifies duration and digest', async () => {
  const { stdout } = await promisify(execFile)('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
    '-codec:a', 'libmp3lame', '-b:a', '128k', '-f', 'mp3', 'pipe:1'], { encoding: 'buffer', maxBuffer: 100_000 });
  const mp3 = Buffer.from(stdout);
  const saved = await privateAudioBody(request(mp3));
  try {
    assert.equal(saved.bytes, mp3.length);
    assert.equal(saved.sha256, createHash('sha256').update(mp3).digest('hex'));
    assert.ok(saved.durationSeconds > 0 && saved.durationSeconds < 3);
    assert.deepEqual(await readFile(saved.file), mp3);
  } finally { await rm(saved.directory, { recursive: true, force: true }); }
  await assert.rejects(privateAudioBody(request(mp3, 'audio/mp4')), /Expected MP3/);
  await assert.rejects(privateAudioBody(request(mp3, 'audio/mpeg', mp3.length - 1)), /declared size/);
  await assert.rejects(privateAudioBody(request(mp3, 'audio/mpeg', MAX_PRIVATE_AUDIO_BYTES + 1)), /320 MB/);
  await assert.rejects(privateAudioBody(request(Buffer.from('ID3not-mp3'))), /duration could not be verified/);
});
