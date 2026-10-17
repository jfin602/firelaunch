import { abortVideoUpload, finalizeVideoUpload, startVideoUpload, videoUploadPart, type VideoUploadStatus } from './api.js';

// Browser hashing buffers the selected file. Keep this UI limit below the server's larger upload ceiling.
export const STUDIO_VIDEO_MAX_BYTES = 250_000_000;
export function titleFromFilename(filename: string): string {
  return filename.replace(/\.mp4$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}
export async function hashVideoFile(file: File): Promise<string> {
  if (!crypto?.subtle) throw new Error('Secure browser hashing is unavailable.');
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}
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

/** Browser metadata is an upload admission claim; MediaConvert output must be verified before delivery. */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      const seconds = Math.ceil(video.duration);
      window.clearTimeout(timer);
      video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
      if (error) reject(error);
      else {
        if (!Number.isInteger(seconds) || seconds < 1 || seconds > 1800)
          reject(new Error('Choose a video between 1 second and 30 minutes.'));
        else resolve(seconds);
      }
    };
    const timer = window.setTimeout(() => finish(new Error('Could not read video duration. Check the MP4 and try again.')), 15000);
    video.onloadedmetadata = () => finish();
    video.onerror = () => finish(new Error('Could not read video metadata. Choose a supported MP4.'));
    video.preload = 'metadata'; video.src = url;
  });
}

/** Best-effort local still; failure leaves an explicitly unverified draft placeholder. */
export async function extractVideoThumbnail(file: File): Promise<File | null> {
  const canvas = document.createElement('canvas');
  let context: CanvasRenderingContext2D | null;
  try { context = canvas.getContext('2d'); }
  catch { return null; }
  if (!context) return null;
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let finished = false;
    const finish = (value: File | null) => {
      if (finished) return;
      finished = true; window.clearTimeout(timer);
      video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), 5000);
    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      try { video.currentTime = Math.min(1, Math.max(0, video.duration / 2)); }
      catch { finish(null); }
    };
    video.onseeked = () => {
      if (!video.videoWidth || !video.videoHeight) { finish(null); return; }
      const scale = Math.min(1, 640 / video.videoWidth, 360 / video.videoHeight);
      canvas.width = Math.max(1, Math.floor(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.floor(video.videoHeight * scale));
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => finish(blob && blob.size > 0 && blob.size <= 1_000_000
          ? new File([blob], 'video-thumbnail.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.78);
      } catch { finish(null); }
    };
    video.muted = true; video.preload = 'auto'; video.src = url;
  });
}

export async function uploadVideo(projectId: string, mediaAssetId: string, file: File,
  signal: AbortSignal, onProgress: (percent: number) => void, onSession: (session: VideoUploadStatus) => void,
  inspectedDurationSeconds?: number, inspectedSha256?: string): Promise<VideoUploadStatus> {
  validateVideoFile(file);
  const durationSeconds = inspectedDurationSeconds ?? await readVideoDuration(file);
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 1800)
    throw new Error('Choose a video between 1 second and 30 minutes.');
  const digest = inspectedSha256 ?? await hashVideoFile(file);
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('Video checksum is invalid.');
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
