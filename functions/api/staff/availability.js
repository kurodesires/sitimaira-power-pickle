import { json, manilaNow, requireStaff, sameOrigin } from '../../../lib/cloudflare.js';

const activities = ['Pickleball', 'Billiards'];
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
function timeToMinute(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return null;
  const hour = Number(match[1]); const minute = Number(match[2]);
  if (hour < 6 || hour > 19 || ![0, 30].includes(minute) || (hour === 19 && minute !== 0)) return null;
  return hour * 60 + minute;
}

export async function onRequestGet({ request, env }) {
  if (!await requireStaff(request, env)) return json({ error: 'Sign in required.' }, 401);
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || '';
  const activity = url.searchParams.get('activity') || '';
  if (!validDate(date) || !activities.includes(activity)) return json({ error: 'Choose a valid date and activity.' }, 400);
  try {
    const now = manilaNow();
    const currentMinute = now.hour * 60 + now.minute;
    const { results: blocks } = await env.DB.prepare(`SELECT id, start_minute AS startMinute, end_minute AS endMinute
      FROM walkin_blocks WHERE booking_date = ? AND activity = ? AND (? != booking_date OR end_minute > ?)
      ORDER BY start_minute`).bind(date, activity, now.date, currentMinute).all();
    const { results: bookings } = await env.DB.prepare(`SELECT id, start_hour AS startHour, time_label AS time
      FROM bookings WHERE booking_date = ? AND activity = ? AND payment_status = 'Paid' AND approval_status = 'Approved'
      ORDER BY start_hour`).bind(date, activity).all();
    return json({ blocks, bookings: bookings.map((booking) => ({ ...booking, endMinute: (booking.startHour + 1) * 60 })) });
  } catch {
    return json({ error: 'Availability database is not ready. Apply migrations 0003 and 0004 in the D1 Console, then redeploy.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  if (!await requireStaff(request, env)) return json({ error: 'Sign in required.' }, 401);
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  let input;
  try { input = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const date = String(input.date || '');
  const activity = String(input.activity || '');
  const startMinute = timeToMinute(input.startTime);
  const endMinute = timeToMinute(input.endTime);
  if (!validDate(date) || !activities.includes(activity) || startMinute === null || endMinute === null || endMinute <= startMinute) {
    return json({ error: 'Choose a valid date and time range. Times use 30-minute steps and must be between 6:00 AM and 7:00 PM.' }, 400);
  }
  const now = manilaNow();
  if (date < now.date || (date === now.date && startMinute <= now.hour * 60 + now.minute)) return json({ error: 'The walk-in time must start in the future.' }, 400);
  try {
    const { results: bookings } = await env.DB.prepare(`SELECT start_hour AS startHour FROM bookings
      WHERE booking_date = ? AND activity = ? AND payment_status = 'Paid' AND approval_status = 'Approved'
        AND start_hour * 60 < ? AND (start_hour + 1) * 60 > ?`)
      .bind(date, activity, endMinute, startMinute).all();
    if (bookings.length) return json({ error: 'That time overlaps a confirmed online booking.' }, 409);

    const existingQuery = date === now.date
      ? env.DB.prepare('SELECT 1 FROM walkin_blocks WHERE booking_date = ? AND activity = ? AND start_minute < ? AND end_minute > ? AND end_minute > ? LIMIT 1').bind(date, activity, endMinute, startMinute, now.hour * 60 + now.minute)
      : env.DB.prepare('SELECT 1 FROM walkin_blocks WHERE booking_date = ? AND activity = ? AND start_minute < ? AND end_minute > ? LIMIT 1').bind(date, activity, endMinute, startMinute);
    if (await existingQuery.first()) return json({ error: 'That time overlaps an existing walk-in booking.' }, 409);

    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO walkin_blocks (id, activity, booking_date, start_minute, end_minute, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, activity, date, startMinute, endMinute, new Date().toISOString()).run();
    return json({ ok: true, id }, 201);
  } catch {
    return json({ error: 'Availability database is not ready. Apply migrations 0003 and 0004 in the D1 Console, then redeploy.' }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  if (!await requireStaff(request, env)) return json({ error: 'Sign in required.' }, 401);
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  let input;
  try { input = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!input || typeof input.id !== 'string') return json({ error: 'Choose a valid walk-in time.' }, 400);
  try {
    const result = await env.DB.prepare('DELETE FROM walkin_blocks WHERE id = ?').bind(input.id).run();
    return result.meta.changes ? json({ ok: true }) : json({ error: 'Walk-in time not found.' }, 404);
  } catch {
    return json({ error: 'Availability database is not ready. Apply migrations 0003 and 0004 in the D1 Console, then redeploy.' }, 503);
  }
}
