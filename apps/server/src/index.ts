import { createApi } from './api.js';
import { ProjectRepository } from './repository.js';

const port = Number(process.env.PORT ?? 4174);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const repository = new ProjectRepository(process.env.FIRELAUNCH_DATA_DIR ?? '.firelaunch-data');
createApi(repository).listen(port, '127.0.0.1', () => console.log(`FireLaunch API listening on http://127.0.0.1:${port}`));
