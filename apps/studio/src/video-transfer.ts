import type { VideoUploadStatus } from './api.js';
import { uploadVideo } from './video-upload.js';

export type VideoTransfer = {
  accountId: string; projectId: string; itemId: string; assetId: string;
  progress: number; state: 'uploading' | 'completed' | 'failed' | 'stopped';
  session: VideoUploadStatus | null; error: string;
};
type ActiveTransfer = { snapshot: VideoTransfer; controller: AbortController };
const transfers = new Map<string, ActiveTransfer>();
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };
const key = (accountId: string, projectId: string, itemId: string) => `${accountId}:${projectId}:${itemId}`;

export function subscribeVideoTransfers(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function videoTransfers(accountId: string, projectId?: string): VideoTransfer[] {
  return [...transfers.values()].map(value => value.snapshot)
    .filter(value => value.accountId === accountId && (!projectId || value.projectId === projectId));
}
export function videoTransfer(accountId: string, projectId: string, itemId: string): VideoTransfer | undefined {
  return transfers.get(key(accountId, projectId, itemId))?.snapshot;
}
export function stopVideoTransfer(accountId: string, projectId: string, itemId: string): void {
  transfers.get(key(accountId, projectId, itemId))?.controller.abort();
}
export function clearVideoTransfers(accountId: string): void {
  for (const [id, transfer] of transfers) if (transfer.snapshot.accountId === accountId) {
    transfer.controller.abort(); transfers.delete(id);
  }
  emit();
}

/** Lives for the authenticated tab, independently of the video popup. Never persists a File. */
export function startVideoTransfer(input: { accountId: string; projectId: string; itemId: string; assetId: string;
  file: File; durationSeconds: number; sha256: string }): Promise<VideoUploadStatus> {
  const id = key(input.accountId, input.projectId, input.itemId);
  if (transfers.get(id)?.snapshot.state === 'uploading') throw new Error('This video is already uploading in this tab.');
  const controller = new AbortController();
  const snapshot: VideoTransfer = { accountId: input.accountId, projectId: input.projectId,
    itemId: input.itemId, assetId: input.assetId, progress: 0, state: 'uploading', session: null, error: '' };
  transfers.set(id, { snapshot, controller }); emit();
  const publish = () => { if (transfers.get(id)?.snapshot === snapshot) emit(); };
  return uploadVideo(input.projectId, input.assetId, input.file, controller.signal,
    progress => { snapshot.progress = progress; publish(); },
    session => { snapshot.session = session; publish(); }, input.durationSeconds, input.sha256)
    .then(session => { snapshot.session = session; snapshot.state = 'completed'; publish(); return session; })
    .catch(reason => {
      snapshot.state = controller.signal.aborted ? 'stopped' : 'failed';
      snapshot.error = controller.signal.aborted ? 'Upload stopped. Select the file again to retry.' :
        reason instanceof Error ? reason.message : String(reason);
      publish(); throw reason;
    });
}
