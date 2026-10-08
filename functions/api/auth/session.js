import { json, requireStaff } from '../../../lib/cloudflare.js';

export async function onRequestGet({ request, env }) {
  const session = await requireStaff(request, env);
  return json({ authenticated: Boolean(session) }, session ? 200 : 401);
}
