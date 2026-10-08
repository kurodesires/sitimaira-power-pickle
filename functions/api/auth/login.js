import { createSessionToken, json, sameOrigin, sessionCookie } from '../../../lib/cloudflare.js';

function equalSecret(input, expected) {
  const left = new TextEncoder().encode(String(input ?? ''));
  const right = new TextEncoder().encode(String(expected ?? ''));
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) difference |= (left[index] || 0) ^ (right[index] || 0);
  return difference === 0;
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  if (!env.STAFF_USERNAME || !env.STAFF_PASSWORD || !env.SESSION_SECRET) return json({ error: 'Staff login is not configured.' }, 503);
  let credentials;
  try { credentials = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!credentials || typeof credentials !== 'object') return json({ error: 'Invalid request.' }, 400);
  if (!equalSecret(credentials.username, env.STAFF_USERNAME) || !equalSecret(credentials.password, env.STAFF_PASSWORD)) {
    return json({ error: 'Username or password is incorrect.' }, 401);
  }
  const token = await createSessionToken(env.STAFF_USERNAME, env.SESSION_SECRET);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token) });
}
