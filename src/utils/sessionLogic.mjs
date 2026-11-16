export function isOwnApiRequest(config, apiBase) {
  try {
    const base = new URL(apiBase);
    const target = new URL(config.url, config.baseURL ? `${config.baseURL.replace(/\/$/, '')}/` : `${base.origin}/`);
    return target.origin === base.origin && (target.pathname === base.pathname || target.pathname.startsWith(`${base.pathname}/`));
  } catch { return false; }
}

export function shouldExpireSession(error, currentToken, apiBase) {
  return Boolean(currentToken && error.response?.status === 401
    && isOwnApiRequest(error.config || {}, apiBase)
    && !String(error.config?.url || '').includes('/auth/')
    && error.config?.headers?.Authorization === `Bearer ${currentToken}`);
}
