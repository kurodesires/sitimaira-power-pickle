import { allowedStartHour, json, manilaNow, sameOrigin } from '../../lib/cloudflare.js';

const AMOUNTS = { Pickleball: 300, Billiards: 100 };

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  let booking;
  try { booking = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const name = String(booking.name || '').trim();
  const phone = String(booking.phone || '').trim();
  const email = String(booking.email || '').trim().toLowerCase();
  const activity = String(booking.activity || '');
  const date = String(booking.date || '');
  const time = String(booking.time || '');
  const paymentMethod = String(booking.paymentMethod || '');
  const startHour = allowedStartHour(time);
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
  if (name.length < 2 || name.length > 100 || phone.length < 7 || phone.length > 30 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid name, contact number, and email.' }, 400);
  if (!Object.hasOwn(AMOUNTS, activity) || !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || startHour === null || !['GCash', 'MariBank'].includes(paymentMethod)) return json({ error: 'Invalid booking details.' }, 400);
  const now = manilaNow();
  if (date < now.date || (date === now.date && startHour <= now.hour)) return json({ error: 'That date or time has already passed.' }, 400);
  const occupied = await env.DB.prepare(`SELECT id FROM bookings
    WHERE activity = ? AND booking_date = ? AND start_hour = ? AND payment_status = 'Paid' LIMIT 1`)
    .bind(activity, date, startHour).first();
  if (occupied) return json({ error: 'That slot has already been paid for. Choose another time.' }, 409);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO bookings (id, name, phone, email, activity, booking_date, time_label, start_hour, payment_method, amount, booking_status, payment_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Awaiting payment', 'Unpaid', ?)`)
    .bind(id, name, phone, email, activity, date, time, startHour, paymentMethod, AMOUNTS[activity], createdAt).run();
  return json({ id, status: 'Awaiting payment', paymentStatus: 'Unpaid' }, 201);
}
