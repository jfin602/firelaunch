import { abortVideoUpload, finalizeVideoUpload, startVideoUpload, videoUploadPart, type VideoUploadStatus } from './api.js';

// Browser hashing buffers the selected file. Keep this UI limit below the server's larger upload ceiling.
export const STUDIO_VIDEO_MAX_BYTES = 250_000_000;
export function validateVideoFile(file: File): void {
  if (file.type !== 'video/mp4' || !/^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,120}\.mp4$/i.test(file.name))
    throw new Error('Choose an MP4 file with a simple .mp4 filename.');
  if (!file.size || file.size > STUDIO_VIDEO_MAX_BYTES)
    throw new Error('Choose a nonempty MP4 under 250 MB.');
}

function putPart(url: string, body: Blob, signal: AbortSignal, onProgress: (bytes: number) => void): Promise<string> {
  if (new URL(url).protocol !== 'https:') throw new Error('Upload part URL must use HTTPS.');
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const stop = () => xhr.abort();
    const finish = () => signal.removeEventListener('abort', stop);
    xhr.open('PUT', url);
    xhr.withCredentials = false;
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded); };
    xhr.onerror = () => { finish(); reject(new Error('Direct upload failed. Retry with a new session.')); };
    xhr.onabort = () => { finish(); reject(new Error('Upload canceled.')); };
    xhr.onload = () => {
      finish();
      const etag = xhr.getResponseHeader('ETag');
      if (xhr.status < 200 || xhr.status >= 300 || !etag) reject(new Error('Upload part failed or ETag was unavailable. Check S3 CORS and retry.'));
      else resolve(etag);
    };
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop(); else xhr.send(body);
  });
}

export async function uploadVideo(projectId: string, mediaAssetId: string, file: File, durationSeconds: number,
  signal: AbortSignal, onProgress: (percent: number) => void, onSession: (session: VideoUploadStatus) => void): Promise<VideoUploadStatus> {
  validateVideoFile(file);
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 14400)
    throw new Error('Enter a duration from 1 second to 4 hours.');
  if (!crypto?.subtle) throw new Error('Secure browser hashing is unavailable.');
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (signal.aborted) throw new Error('Upload canceled.');
  const session = await startVideoUpload(projectId, { mediaAssetId, idempotencyKey: crypto.randomUUID().replaceAll('-', ''),
    fileName: file.name, contentType: 'video/mp4', expectedBytes: file.size, expectedSha256: digest, claimedDurationSeconds: durationSeconds });
  onSession(session);
  try {
    const parts: { partNumber: number; etag: string }[] = [];
    for (let partNumber = 1; partNumber <= session.partCount; partNumber++) {
      if (signal.aborted) throw new Error('Upload canceled.');
      const signed = await videoUploadPart(projectId, session.id, mediaAssetId, partNumber);
      const offset = (partNumber - 1) * session.partSize;
      const blob = file.slice(offset, offset + session.partSize);
      if (signed.contentLength !== blob.size) throw new Error('Upload part size changed. Retry with a new session.');
      const etag = await putPart(signed.url, blob, signal, bytes => onProgress(Math.min(100, Math.floor((offset + bytes) * 100 / file.size))));
      parts.push({ partNumber, etag });
      onProgress(Math.floor((offset + blob.size) * 100 / file.size));
    }
    if (signal.aborted) throw new Error('Upload canceled.');
    return await finalizeVideoUpload(projectId, session.id, mediaAssetId, parts);
  } catch (error) {
    await abortVideoUpload(projectId, session.id, mediaAssetId).catch(() => undefined);
    throw error;
  }
}
