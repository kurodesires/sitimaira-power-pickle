import { json, manilaNow, requireStaff, sameOrigin } from '../../../../../lib/cloudflare.js';

export async function onRequestPost({ request, env, params }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  if (!await requireStaff(request, env)) return json({ error: 'Sign in required.' }, 401);
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  const now = manilaNow();
  try {
    const result = await env.DB.prepare(`UPDATE bookings
      SET payment_status = 'Paid', booking_status = CASE WHEN approval_status = 'Approved' THEN 'Confirmed' ELSE 'Pending admin approval' END
      WHERE id = ? AND payment_status = 'Unpaid'
        AND NOT EXISTS (
          SELECT 1 FROM walkin_blocks AS closed
          WHERE closed.activity = bookings.activity
            AND closed.booking_date = bookings.booking_date
            AND closed.start_minute < (bookings.start_hour + 1) * 60
            AND closed.end_minute > bookings.start_hour * 60
            AND (bookings.booking_date != ? OR closed.end_minute > ?)
        )
        AND NOT EXISTS (
          SELECT 1 FROM bookings AS paid
          WHERE paid.activity = bookings.activity
            AND paid.booking_date = bookings.booking_date
            AND paid.start_hour = bookings.start_hour
            AND paid.payment_status = 'Paid'
            AND paid.approval_status = 'Approved'
        )`).bind(params.id, now.date, now.hour * 60 + now.minute).run();
    if (result.meta.changes === 1) return json({ ok: true });
    const existing = await env.DB.prepare('SELECT payment_status FROM bookings WHERE id = ?').bind(params.id).first();
    if (!existing) return json({ error: 'Booking not found.' }, 404);
    if (existing.payment_status === 'Paid') return json({ error: 'This booking is already paid.' }, 409);
    const closed = await env.DB.prepare(`SELECT 1 FROM walkin_blocks AS block
      JOIN bookings ON bookings.id = ? AND block.activity = bookings.activity AND block.booking_date = bookings.booking_date
      AND block.start_minute < (bookings.start_hour + 1) * 60 AND block.end_minute > bookings.start_hour * 60
      AND (bookings.booking_date != ? OR block.end_minute > ?) LIMIT 1`).bind(params.id, now.date, now.hour * 60 + now.minute).first();
    if (closed) return json({ error: 'A walk-in booking currently occupies this time.' }, 409);
    return json({ error: 'Another paid booking already occupies this slot.' }, 409);
  } catch {
    return json({ error: 'Could not mark this booking paid. Check whether the slot is already booked.' }, 409);
  }
}
