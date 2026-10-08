import { json, requireStaff, sameOrigin } from '../../../../lib/cloudflare.js';

export async function onRequestDelete({ request, env, params }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  if (!await requireStaff(request, env)) return json({ error: 'Sign in required.' }, 401);
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  const result = await env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(params.id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: 'Booking not found.' }, 404);
}
