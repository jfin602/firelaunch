import { createApi } from './api.js';
import { ProjectRepository } from './repository.js';
import { serverModeFromEnv } from './auth/config.js';
import { HostedProjectRepository } from './hosted-repository.js';
import { PrivateObjectService, privateObjectStoreFromEnv } from './private-objects.js';
import { MediaPipelineRepository } from './media-pipeline-repository.js';
import { mediaStorageFromEnv } from './media-storage.js';
import { MediaUploadService } from './media-upload-service.js';

const port = Number(process.env.PORT ?? 4174);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const hostedRepository = process.env.FIRELAUNCH_MODE === 'hosted'
  ? await HostedProjectRepository.connect(process.env.DATABASE_URL ?? '') : undefined;
const mode = serverModeFromEnv(process.env, hostedRepository
  ? principal => hostedRepository.accountForIdentity(principal) : undefined);
const repository = new ProjectRepository(process.env.FIRELAUNCH_DATA_DIR ?? '.firelaunch-data');
const privateObjects = hostedRepository ? new PrivateObjectService(hostedRepository, privateObjectStoreFromEnv(process.env)) : undefined;
const mediaUploads = hostedRepository && process.env.FIRELAUNCH_MEDIA_AWS_REGION
  ? new MediaUploadService(new MediaPipelineRepository(hostedRepository), mediaStorageFromEnv(process.env)) : undefined;
if (mediaUploads) {
  void mediaUploads.cleanupExpired();
  setInterval(() => { void mediaUploads.cleanupExpired(); }, 15 * 60_000).unref();
}
createApi(repository, undefined, mode, hostedRepository, privateObjects, mediaUploads).listen(port, '127.0.0.1', () => console.log(`FireLaunch API listening on 127.0.0.1:${port} (${mode.mode})`));
