import { json, requireStaff, sameOrigin } from '../../../../../lib/cloudflare.js';

export async function onRequestPost({ request, env, params }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  if (!await requireStaff(request, env)) return json({ error: 'Sign in required.' }, 401);
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  try {
    const result = await env.DB.prepare(`UPDATE bookings
      SET payment_status = 'Paid', booking_status = 'Confirmed'
      WHERE id = ? AND payment_status = 'Unpaid'
        AND NOT EXISTS (
          SELECT 1 FROM bookings AS paid
          WHERE paid.activity = bookings.activity
            AND paid.booking_date = bookings.booking_date
            AND paid.start_hour = bookings.start_hour
            AND paid.payment_status = 'Paid'
        )`).bind(params.id).run();
    if (result.meta.changes === 1) return json({ ok: true });
    const existing = await env.DB.prepare('SELECT payment_status FROM bookings WHERE id = ?').bind(params.id).first();
    if (!existing) return json({ error: 'Booking not found.' }, 404);
    if (existing.payment_status === 'Paid') return json({ error: 'This booking is already paid.' }, 409);
    return json({ error: 'Another paid booking already occupies this slot.' }, 409);
  } catch {
    return json({ error: 'Could not mark this booking paid. Check whether the slot is already booked.' }, 409);
  }
}
