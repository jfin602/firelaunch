/** HTTP exceptions are limited to an explicitly enabled, loopback development process. */
export function localHostedHttp(url: URL, env: NodeJS.ProcessEnv): boolean {
  return env.FIRELAUNCH_LOCAL_HOSTED === '1' && env.NODE_ENV === 'development'
    && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
    && !url.username && !url.password && !url.hash;
}
