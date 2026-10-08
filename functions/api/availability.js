import { json } from '../../lib/cloudflare.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'Booking database is not configured.' }, 503);
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || '';
  const activity = url.searchParams.get('activity') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['Pickleball', 'Billiards'].includes(activity)) return json({ error: 'Choose a valid date and activity.' }, 400);
  const { results } = await env.DB.prepare('SELECT time_label FROM bookings WHERE booking_date = ? AND activity = ? AND payment_status = \'Paid\'')
    .bind(date, activity).all();
  return json({ bookedTimes: results.map((row) => row.time_label) });
}
