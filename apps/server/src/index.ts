import { createApi } from './api.js';
import { ProjectRepository } from './repository.js';
import { serverModeFromEnv } from './auth/config.js';
import { HostedProjectRepository } from './hosted-repository.js';
import { PrivateObjectService, privateObjectStoreFromEnv } from './private-objects.js';

const port = Number(process.env.PORT ?? 4174);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const hostedRepository = process.env.FIRELAUNCH_MODE === 'hosted'
  ? await HostedProjectRepository.connect(process.env.DATABASE_URL ?? '') : undefined;
const mode = serverModeFromEnv(process.env, hostedRepository
  ? principal => hostedRepository.accountForIdentity(principal) : undefined);
const repository = new ProjectRepository(process.env.FIRELAUNCH_DATA_DIR ?? '.firelaunch-data');
const privateObjects = hostedRepository ? new PrivateObjectService(hostedRepository, privateObjectStoreFromEnv(process.env)) : undefined;
createApi(repository, undefined, mode, hostedRepository, privateObjects).listen(port, '127.0.0.1', () => console.log(`FireLaunch API listening on 127.0.0.1:${port} (${mode.mode})`));
