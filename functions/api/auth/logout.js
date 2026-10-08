import { clearSessionCookie, json, sameOrigin } from '../../../lib/cloudflare.js';

export async function onRequestPost({ request }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
}
