import { json, requireStaff, sameOrigin } from '../../../../../lib/cloudflare.js';

export async function onRequestPost({ request, env, params }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  if (!await requireStaff(request, env)) return json({ error: 'Sign in required.' }, 401);
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  const result = await env.DB.prepare(`UPDATE bookings
    SET approval_status = 'Approved',
        booking_status = CASE WHEN payment_status = 'Paid' THEN 'Confirmed' ELSE 'Approved · awaiting payment' END
    WHERE id = ? AND approval_status = 'Pending'
      AND NOT EXISTS (
        SELECT 1 FROM slot_controls AS closed
        WHERE closed.activity = bookings.activity
          AND closed.booking_date = bookings.booking_date
          AND closed.start_hour = bookings.start_hour
          AND closed.is_available = 0
      )
      AND (payment_status != 'Paid' OR NOT EXISTS (
        SELECT 1 FROM bookings AS occupied
        WHERE occupied.activity = bookings.activity
          AND occupied.booking_date = bookings.booking_date
          AND occupied.start_hour = bookings.start_hour
          AND occupied.payment_status = 'Paid'
          AND occupied.approval_status = 'Approved'
      ))`).bind(params.id).run();
  if (result.meta.changes === 1) return json({ ok: true });
  const existing = await env.DB.prepare('SELECT payment_status, approval_status FROM bookings WHERE id = ?').bind(params.id).first();
  if (!existing) return json({ error: 'Booking not found.' }, 404);
  if (existing.approval_status === 'Approved') return json({ error: 'This booking is already approved.' }, 409);
  return json({ error: 'A paid and approved booking already occupies this slot.' }, 409);
}
