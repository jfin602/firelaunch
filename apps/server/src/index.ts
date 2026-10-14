import { createApi } from './api.js';
import { ProjectRepository } from './repository.js';
import { serverModeFromEnv } from './auth/config.js';
import { HostedProjectRepository } from './hosted-repository.js';
import { PrivateObjectService, privateObjectStoreFromEnv } from './private-objects.js';
import { MediaPipelineRepository } from './media-pipeline-repository.js';
import { mediaStorageFromEnv } from './media-storage.js';
import { MediaUploadService } from './media-upload-service.js';
import { ManagedMediaJobRepository } from './managed-media-job-repository.js';
import { AwsMediaConvertProvider, fixedMediaConvertProfile, mediaConvertConfigFromEnv } from './media-convert-provider.js';
import { ManagedMediaCoordinator } from './managed-media-coordinator.js';
import { MediaConvertEventsQueue } from './media-convert-events-queue.js';
import { SQSClient } from '@aws-sdk/client-sqs';

const port = Number(process.env.PORT ?? 4174);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const hostedRepository = process.env.FIRELAUNCH_MODE === 'hosted'
  ? await HostedProjectRepository.connect(process.env.DATABASE_URL ?? '') : undefined;
const mode = serverModeFromEnv(process.env, hostedRepository
  ? principal => hostedRepository.accountForIdentity(principal) : undefined);
const repository = new ProjectRepository(process.env.FIRELAUNCH_DATA_DIR ?? '.firelaunch-data');
const privateObjects = hostedRepository ? new PrivateObjectService(hostedRepository, privateObjectStoreFromEnv(process.env)) : undefined;
const mediaStorage = hostedRepository && process.env.FIRELAUNCH_MEDIA_AWS_REGION
  ? mediaStorageFromEnv(process.env) : undefined;
const managed = hostedRepository && mediaStorage && process.env.FIRELAUNCH_MEDIACONVERT_ACCOUNT
  ? await (async () => {
    const config = mediaConvertConfigFromEnv(process.env);
    const profile = await fixedMediaConvertProfile();
    return new ManagedMediaCoordinator(new MediaPipelineRepository(hostedRepository),
      new ManagedMediaJobRepository(hostedRepository.pool), mediaStorage,
      new AwsMediaConvertProvider(config, profile), config, profile);
  })() : undefined;
const mediaUploads = hostedRepository && mediaStorage
  ? new MediaUploadService(new MediaPipelineRepository(hostedRepository), mediaStorage, managed) : undefined;
if (mediaUploads) {
  void mediaUploads.cleanupExpired();
  setInterval(() => { void mediaUploads.cleanupExpired(); }, 15 * 60_000).unref();
}
if (managed) {
  void managed.reconcileDue().catch(() => undefined);
  setInterval(() => { void managed.reconcileDue().catch(() => undefined); }, 60_000).unref();
  if (process.env.FIRELAUNCH_MEDIACONVERT_EVENT_QUEUE_URL) {
    const queue = new MediaConvertEventsQueue(managed,
      process.env.FIRELAUNCH_MEDIACONVERT_EVENT_QUEUE_URL,
      new SQSClient({ region: mediaConvertConfigFromEnv(process.env).awsRegion }));
    void queue.poll().catch(() => undefined);
    setInterval(() => { void queue.poll().catch(() => undefined); }, 10_000).unref();
  }
}
createApi(repository, undefined, mode, hostedRepository, privateObjects, mediaUploads, mediaStorage).listen(port, '127.0.0.1', () => console.log(`FireLaunch API listening on 127.0.0.1:${port} (${mode.mode})`));
