import { json, manilaNow, requireStaff, sameOrigin } from '../../../../../lib/cloudflare.js';

export async function onRequestPost({ request, env, params }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  if (!await requireStaff(request, env)) return json({ error: 'Sign in required.' }, 401);
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  const now = manilaNow();
  const result = await env.DB.prepare(`UPDATE bookings
    SET approval_status = 'Approved',
        booking_status = CASE WHEN payment_status = 'Paid' THEN 'Confirmed' ELSE 'Approved · awaiting payment' END
    WHERE id = ? AND approval_status = 'Pending'
      AND NOT EXISTS (
        SELECT 1 FROM walkin_blocks AS closed
        WHERE closed.activity = bookings.activity
          AND closed.booking_date = bookings.booking_date
          AND closed.start_minute < (bookings.start_hour + 1) * 60
          AND closed.end_minute > bookings.start_hour * 60
          AND (bookings.booking_date != ? OR closed.end_minute > ?)
      )
      AND (payment_status != 'Paid' OR NOT EXISTS (
        SELECT 1 FROM bookings AS occupied
        WHERE occupied.activity = bookings.activity
          AND occupied.booking_date = bookings.booking_date
          AND occupied.start_hour = bookings.start_hour
          AND occupied.payment_status = 'Paid'
          AND occupied.approval_status = 'Approved'
      ))`).bind(params.id, now.date, now.hour * 60 + now.minute).run();
  if (result.meta.changes === 1) return json({ ok: true });
  const existing = await env.DB.prepare('SELECT payment_status, approval_status FROM bookings WHERE id = ?').bind(params.id).first();
  if (!existing) return json({ error: 'Booking not found.' }, 404);
  if (existing.approval_status === 'Approved') return json({ error: 'This booking is already approved.' }, 409);
  const closed = await env.DB.prepare(`SELECT 1 FROM walkin_blocks AS block
    JOIN bookings ON bookings.id = ? AND block.activity = bookings.activity AND block.booking_date = bookings.booking_date
      AND block.start_minute < (bookings.start_hour + 1) * 60 AND block.end_minute > bookings.start_hour * 60
      AND (bookings.booking_date != ? OR block.end_minute > ?) LIMIT 1`).bind(params.id, now.date, now.hour * 60 + now.minute).first();
  if (closed) return json({ error: 'A walk-in booking currently occupies this time.' }, 409);
  return json({ error: 'A paid and approved booking already occupies this slot.' }, 409);
}
