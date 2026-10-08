import { json, requireStaff } from '../../../lib/cloudflare.js';

export async function onRequestGet({ request, env }) {
  if (!await requireStaff(request, env)) return json({ error: 'Sign in required.' }, 401);
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  const { results } = await env.DB.prepare(`SELECT id, name, phone, email, activity, booking_date AS date, time_label AS time,
      payment_method AS payment, amount, booking_status AS status, payment_status AS paymentStatus, created_at AS createdAt
    FROM bookings ORDER BY booking_date, start_hour, created_at`).all();
  return json({ bookings: results });
}
