const encoder = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return origin && origin === new URL(request.url).origin;
}

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64url(value) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionToken(username, secret) {
  const payload = base64url(encoder.encode(JSON.stringify({ username, expires: Date.now() + 8 * 60 * 60 * 1000 })));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload)));
  return `${payload}.${base64url(signature)}`;
}

export async function getSession(request, env) {
  if (!env.SESSION_SECRET || !env.STAFF_USERNAME) return null;
  const cookieHeader = request.headers.get('Cookie') || '';
  const token = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith('sitimaira_session='))?.slice('sitimaira_session='.length);
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  try {
    const key = await hmacKey(env.SESSION_SECRET);
    const valid = await crypto.subtle.verify('HMAC', key, fromBase64url(signature), encoder.encode(payload));
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(fromBase64url(payload)));
    if (session.username !== env.STAFF_USERNAME || typeof session.expires !== 'number' || session.expires <= Date.now()) return null;
    return session;
  } catch { return null; }
}

export async function requireStaff(request, env) {
  return getSession(request, env);
}

export function sessionCookie(token) {
  return `sitimaira_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}

export function clearSessionCookie() {
  return 'sitimaira_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

export function manilaNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, hour: Number(values.hour) };
}

export function allowedStartHour(timeLabel) {
  const match = /^(\d{1,2}):00 (AM|PM)$/.exec(timeLabel || '');
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[2] === 'PM') hour += 12;
  return hour >= 6 && hour < 19 ? hour : null;
}
