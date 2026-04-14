'use strict';

// Central fetch wrapper — attaches JWT header and throws on non-2xx responses.
async function api(method, path, body = null, isForm = false) {
  const headers = {};
  if (state.token)        headers['Authorization'] = 'Bearer ' + state.token;
  if (body && !isForm)    headers['Content-Type']  = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isForm ? body : JSON.stringify(body);

  const res  = await fetch('/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
