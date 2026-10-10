import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { ZodError, z } from 'zod';
import { applyMutation, mutationSchema } from '@firelaunch/channel-engine';
import { createProjectSchema, updateProjectSchema } from '@firelaunch/contracts';
import { agentRequestSchema, BedrockProvider, ChannelAgent, MockProvider, providerStatus, type AgentProvider } from '@firelaunch/agent';
import { ProjectRepository, RepositoryError } from './repository.js';
import { WorkspaceService } from './workspace.js';
import type { ServerMode } from './auth/config.js';
import type { HostedProjectRepository } from './hosted-repository.js';

const mutationRequestSchema = z.strictObject({ expectedRevision: z.number().int().positive(), mutation: mutationSchema });
const saveSourceSchema = z.strictObject({ path: z.string().max(240), content: z.string().max(256_000), expectedHash: z.string().regex(/^[a-f0-9]{64}$/) });
const MAX_BODY_BYTES = 1_000_000;

async function body(request: IncomingMessage): Promise<unknown> {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new ZodError([{ code: 'custom', path: [], message: 'Expected application/json' }]);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new ZodError([{ code: 'custom', path: [], message: 'Request body too large' }]);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ZodError([{ code: 'custom', path: [], message: 'Invalid JSON' }]); }
}

function respond(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(value));
}

export function createApi(repository: ProjectRepository, selectedProvider?: AgentProvider, mode?: ServerMode, hostedRepository?: HostedProjectRepository) {
  const status = selectedProvider ? { provider: selectedProvider.name, configured: true, message: selectedProvider.name === 'mock' ? 'Deterministic mock; no cloud request.' : 'Bedrock configured; credentials and model access checked on request.' } : providerStatus(process.env);
  const agent = status.configured ? new ChannelAgent(selectedProvider ?? (status.provider === 'mock' ? new MockProvider() : new BedrockProvider(process.env.BEDROCK_MODEL_ID!))) : null;
  const workspace = new WorkspaceService(repository);
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '', 'http://localhost');
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments[0] === 'api' && segments[1] === 'auth' && mode?.mode === 'hosted') {
        const auth = mode.auth;
        if (segments.length === 3 && segments[2] === 'login' && request.method === 'GET') { auth.begin(request, response); return; }
        if (segments.length === 3 && segments[2] === 'callback' && request.method === 'GET') { await auth.callback(request, response, url); return; }
        if (segments.length === 3 && segments[2] === 'session' && request.method === 'GET') {
          const session = auth.session(request);
          if (!session) { respond(response, 401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }); return; }
          respond(response, 200, { accountId: session.principal.accountId, email: session.principal.email, csrfToken: session.csrf, expiresAt: new Date(session.expiresAt).toISOString() }); return;
        }
        if (segments.length === 3 && segments[2] === 'logout' && request.method === 'POST') { auth.logout(request, response); return; }
      }
      if (segments[0] === 'api' && segments[1] === 'projects' && mode?.mode === 'hosted') {
        const session = mode.auth.session(request);
        if (!session) { respond(response, 401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }); return; }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method ?? '') && !mode.auth.authorizedMutation(request, session)) { respond(response, 403, { error: { code: 'CSRF', message: 'Invalid request origin or CSRF token' } }); return; }
        if (hostedRepository && !url.search) {
          const principal = session.principal;
          if (segments.length === 2 && request.method === 'POST') { respond(response, 201, await hostedRepository.create(principal, await body(request))); return; }
          if (segments.length === 2 && request.method === 'GET') { respond(response, 200, await hostedRepository.list(principal)); return; }
          if (segments.length === 3 && request.method === 'GET') { respond(response, 200, await hostedRepository.read(principal, segments[2]!)); return; }
          if (segments.length === 3 && request.method === 'PUT') {
            const input = updateProjectSchema.parse(await body(request));
            respond(response, 200, await hostedRepository.update(principal, segments[2]!, input.expectedRevision, input.spec)); return;
          }
          if (segments.length === 4 && segments[3] === 'mutations' && request.method === 'POST') {
            const input = mutationRequestSchema.parse(await body(request));
            const current = await hostedRepository.read(principal, segments[2]!);
            if (current.revision !== input.expectedRevision) throw new RepositoryError('CONFLICT', 'Project revision changed');
            respond(response, 200, await hostedRepository.update(principal, current.id, input.expectedRevision, applyMutation(current.spec, input.mutation))); return;
          }
        }
        respond(response, 503, { error: { code: 'HOSTED_STORAGE_UNAVAILABLE', message: 'Hosted project storage is not configured' } }); return;
      }
      if (mode?.mode !== 'local-legacy') { respond(response, 401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }); return; }
      if ((url.search && !(segments.length === 5 && segments[3] === 'code' && segments[4] === 'file' && request.method === 'GET')) || segments[0] !== 'api' || segments[1] !== 'projects') {
        respond(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } }); return;
      }
      if (segments.length === 2 && request.method === 'POST') {
        respond(response, 201, await repository.create(createProjectSchema.parse(await body(request)))); return;
      }
      if (segments.length === 2 && request.method === 'GET') {
        respond(response, 200, await repository.list()); return;
      }
      if (segments.length === 3 && request.method === 'GET') {
        respond(response, 200, await repository.read(segments[2]!)); return;
      }
      if (segments.length === 4 && ['code', 'build', 'readiness', 'bundle'].includes(segments[3]!)) {
        const id = segments[2]!;
        const action = segments[3];
        if (action === 'code' && request.method === 'GET') { respond(response, 200, await workspace.overview(id)); return; }
        if (action === 'code' && request.method === 'POST') { z.strictObject({}).parse(await body(request)); respond(response, 200, await workspace.generate(id)); return; }
        if (action === 'build' && request.method === 'GET') { respond(response, 200, await workspace.buildStatus(id)); return; }
        if (action === 'build' && request.method === 'POST') { z.strictObject({}).parse(await body(request)); respond(response, 200, await workspace.build(id)); return; }
        if (action === 'readiness' && request.method === 'GET') { respond(response, 200, await workspace.readiness(id)); return; }
        if (action === 'bundle' && request.method === 'POST') { z.strictObject({}).parse(await body(request)); respond(response, 201, await workspace.bundle(id)); return; }
      }
      if (segments.length === 5 && segments[3] === 'code' && segments[4] === 'file') {
        if (request.method === 'POST') {
          const input = saveSourceSchema.parse(await body(request));
          respond(response, 200, await workspace.save(segments[2]!, input.path, input.content, input.expectedHash)); return;
        }
        if (request.method === 'GET') {
          const name = url.searchParams.get('path');
          if (url.searchParams.size !== 1 || !name) throw new ZodError([{ code: 'custom', path: [], message: 'Expected path' }]);
          respond(response, 200, await workspace.read(segments[2]!, name)); return;
        }
      }
      if (segments.length === 4 && segments[3] === 'agent-status' && request.method === 'GET') {
        await repository.read(segments[2]!);
        respond(response, 200, status); return;
      }
      if (segments.length === 4 && segments[3] === 'agent' && request.method === 'POST') {
        const input = agentRequestSchema.parse(await body(request));
        const current = await repository.read(segments[2]!);
        if (current.revision !== input.expectedRevision) throw new RepositoryError('CONFLICT', 'Project revision changed');
        if (!agent) { respond(response, 503, { error: { code: 'PROVIDER_UNAVAILABLE', message: status.message } }); return; }
        respond(response, 200, await agent.run(current, input.message, (spec, revision) => repository.update(current.id, revision, spec))); return;
      }
      if (segments.length === 3 && request.method === 'PUT') {
        const input = updateProjectSchema.parse(await body(request));
        respond(response, 200, await repository.update(segments[2]!, input.expectedRevision, input.spec)); return;
      }
      if (segments.length === 4 && segments[3] === 'mutations' && request.method === 'POST') {
        const input = mutationRequestSchema.parse(await body(request));
        const current = await repository.read(segments[2]!);
        if (current.revision !== input.expectedRevision) throw new RepositoryError('CONFLICT', 'Project revision changed');
        const spec = applyMutation(current.spec, input.mutation);
        respond(response, 200, await repository.update(current.id, input.expectedRevision, spec)); return;
      }
      respond(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
    } catch (error) {
      if (error instanceof ZodError) respond(response, 400, { error: { code: 'INVALID_INPUT', message: error.issues.map(issue => issue.message).join('; ').slice(0, 500) } });
      else if (error instanceof RepositoryError) respond(response, error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : error.code === 'INVALID_INPUT' ? 400 : 500, { error: { code: error.code, message: error.message } });
      else if (error instanceof Error && (error as NodeJS.ErrnoException).code) respond(response, 500, { error: { code: 'STORAGE_ERROR', message: 'Storage operation failed' } });
      else if (error instanceof Error) respond(response, 400, { error: { code: 'INVALID_INPUT', message: error.message.slice(0, 500) } });
      else respond(response, 500, { error: { code: 'STORAGE_ERROR', message: 'Internal error' } });
    }
  });
}
