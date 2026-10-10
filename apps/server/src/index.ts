import { createApi } from './api.js';
import { ProjectRepository } from './repository.js';
import { serverModeFromEnv } from './auth/config.js';

const port = Number(process.env.PORT ?? 4174);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const mode = serverModeFromEnv(process.env);
const repository = new ProjectRepository(process.env.FIRELAUNCH_DATA_DIR ?? '.firelaunch-data');
createApi(repository, undefined, mode).listen(port, '127.0.0.1', () => console.log(`FireLaunch API listening on 127.0.0.1:${port} (${mode.mode})`));
