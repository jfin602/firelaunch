import { HostedAuth } from './sessions.js';
import { OidcVerifier } from './oidc.js';

export type ServerMode = { mode: 'local-legacy' } | { mode: 'hosted'; auth: HostedAuth };

export function serverModeFromEnv(env: NodeJS.ProcessEnv): ServerMode {
  if (env.FIRELAUNCH_MODE === 'local-legacy') {
    if (env.NODE_ENV === 'production') throw new Error('Local legacy mode is unavailable in production');
    if (env.HOST && !['127.0.0.1', 'localhost', '::1'].includes(env.HOST)) throw new Error('Local legacy mode requires loopback');
    return { mode: 'local-legacy' };
  }
  if (env.FIRELAUNCH_MODE !== 'hosted') throw new Error('Set FIRELAUNCH_MODE to hosted or local-legacy');
  const origin = env.FIRELAUNCH_PUBLIC_ORIGIN;
  const clientId = env.FIRELAUNCH_OIDC_CLIENT_ID;
  const clientSecret = env.FIRELAUNCH_OIDC_CLIENT_SECRET;
  if (!origin || !clientId || !clientSecret || env.FIRELAUNCH_OIDC_ISSUER && env.FIRELAUNCH_OIDC_ISSUER !== 'https://accounts.google.com') throw new Error('Hosted Google OIDC configuration incomplete');
  if (new URL(origin).protocol !== 'https:') throw new Error('Hosted public origin must be HTTPS');
  const verifier = new OidcVerifier({
    issuer: 'https://accounts.google.com', clientId, clientSecret,
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
    redirectUri: `${origin}/api/auth/callback`
  });
  return { mode: 'hosted', auth: new HostedAuth(verifier, origin) };
}
