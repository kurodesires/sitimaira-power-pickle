import { json, requireStaff, sameOrigin } from '../../../lib/cloudflare.js';

const activities = ['Pickleball', 'Billiards'];

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function onRequestGet({ request, env }) {
  if (!await requireStaff(request, env)) return json({ error: 'Sign in required.' }, 401);
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || '';
  const activity = url.searchParams.get('activity') || '';
  if (!validDate(date) || !activities.includes(activity)) return json({ error: 'Choose a valid date and activity.' }, 400);
  const { results: closed } = await env.DB.prepare('SELECT start_hour FROM slot_controls WHERE booking_date = ? AND activity = ? AND is_available = 0')
    .bind(date, activity).all();
  const { results: booked } = await env.DB.prepare("SELECT start_hour FROM bookings WHERE booking_date = ? AND activity = ? AND payment_status = 'Paid' AND approval_status = 'Approved'")
    .bind(date, activity).all();
  return json({ unavailableHours: closed.map((row) => row.start_hour), bookedHours: booked.map((row) => row.start_hour) });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  if (!await requireStaff(request, env)) return json({ error: 'Sign in required.' }, 401);
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  let input;
  try { input = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const date = String(input.date || '');
  const activity = String(input.activity || '');
  const hour = Number(input.hour);
  const available = input.available;
  if (!validDate(date) || !activities.includes(activity) || !Number.isInteger(hour) || hour < 6 || hour >= 19 || typeof available !== 'boolean') {
    return json({ error: 'Choose a valid date, activity, hour, and availability.' }, 400);
  }

  if (available) {
    const booked = await env.DB.prepare("SELECT 1 FROM bookings WHERE booking_date = ? AND activity = ? AND start_hour = ? AND payment_status = 'Paid' AND approval_status = 'Approved' LIMIT 1")
      .bind(date, activity, hour).first();
    if (booked) return json({ error: 'That hour has a confirmed online booking and cannot be reopened.' }, 409);
    await env.DB.prepare('DELETE FROM slot_controls WHERE booking_date = ? AND activity = ? AND start_hour = ?')
      .bind(date, activity, hour).run();
    return json({ ok: true, available: true });
  }

  const booked = await env.DB.prepare("SELECT 1 FROM bookings WHERE booking_date = ? AND activity = ? AND start_hour = ? AND payment_status = 'Paid' AND approval_status = 'Approved' LIMIT 1")
    .bind(date, activity, hour).first();
  if (booked) return json({ error: 'That hour already has a confirmed online booking.' }, 409);
  await env.DB.prepare(`INSERT INTO slot_controls (activity, booking_date, start_hour, is_available, updated_at)
    VALUES (?, ?, ?, 0, ?)
    ON CONFLICT (activity, booking_date, start_hour) DO UPDATE SET is_available = 0, updated_at = excluded.updated_at`)
    .bind(activity, date, hour, new Date().toISOString()).run();
  return json({ ok: true, available: false });
}
