// Talks to this deployment's Worker. On GitHub Pages (or any static host) there is no Worker, so probe() returns null and the app stays in local-only mode.
const TOKEN_KEY = 'bandkit.token';
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} };

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function call(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth && getToken()) headers.authorization = `Bearer ${getToken()}`;
  let res;
  try { res = await fetch(`api/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch (e) { throw new ApiError(0, 'You appear to be offline.'); }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `Request failed (${res.status})`);
  return data;
}

// Returns {cloud:true, configured, bandName, logo}, null when there is no Worker behind this site, or throws ApiError(0) when offline.
export async function probe() {
  let res;
  try { res = await fetch('api/status', { cache: 'no-store' }); }
  catch { throw new ApiError(0, 'offline'); }
  if (!res.ok) return null;
  try { const d = await res.json(); return d && d.cloud ? d : null; } catch { return null; }
}
