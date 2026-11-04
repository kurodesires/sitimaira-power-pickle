import { json, manilaNow } from '../../lib/cloudflare.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || '';
  const activity = url.searchParams.get('activity') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['Pickleball', 'Billiards'].includes(activity)) return json({ error: 'Choose a valid date and activity.' }, 400);
  const { results } = await env.DB.prepare("SELECT time_label FROM bookings WHERE booking_date = ? AND activity = ? AND payment_status = 'Paid' AND approval_status = 'Approved'")
    .bind(date, activity).all();
  try {
    const now = manilaNow();
    const { results: blocks } = await env.DB.prepare(`SELECT start_minute, end_minute FROM walkin_blocks
      WHERE booking_date = ? AND activity = ? AND (? != booking_date OR end_minute > ?)`)
      .bind(date, activity, now.date, now.hour * 60 + now.minute).all();
    const unavailableTimes = [];
    for (let hour = 6; hour < 19; hour += 1) {
      if (blocks.some((block) => block.start_minute < (hour + 1) * 60 && block.end_minute > hour * 60)) {
        unavailableTimes.push(`${hour % 12 || 12}:00 ${hour < 12 ? 'AM' : 'PM'}`);
      }
    }
    return json({ bookedTimes: results.map((row) => row.time_label), unavailableTimes });
  } catch {
    return json({ error: 'Availability is not configured yet. Apply D1 migrations 0003 and 0004, then redeploy.' }, 503);
  }
}
