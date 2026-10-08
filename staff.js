const loginGate = document.getElementById('loginGate');
const loginForm = document.getElementById('staffLoginForm');
const loginMessage = document.getElementById('loginMessage');
const content = document.getElementById('staffContent');
const rows = document.getElementById('bookingRows');
const empty = document.getElementById('emptyState');
const summary = document.getElementById('staffSummary');
let authenticated = false;

async function requestJson(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}
function showDashboard(isLoggedIn) {
  authenticated = isLoggedIn;
  loginGate.hidden = isLoggedIn;
  content.hidden = !isLoggedIn;
  document.title = isLoggedIn ? 'Staff bookings | Sitimaira Power Pickle' : 'Staff login | Sitimaira Power Pickle';
  if (isLoggedIn) render();
}
function cell(text) { const td = document.createElement('td'); td.textContent = text ?? ''; return td; }
function actionButton(label, className, handler) {
  const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = label;
  button.addEventListener('click', handler); return button;
}
async function render() {
  if (!authenticated) return;
  try {
    const { bookings } = await requestJson('/api/staff/bookings');
    rows.replaceChildren(); empty.hidden = bookings.length > 0;
    summary.innerHTML = `<div><b>${bookings.length}</b><span>Total booking requests</span></div><div><b>${bookings.filter((booking) => booking.paymentStatus !== 'Paid').length}</b><span>Unpaid · slot open</span></div><div><b>${bookings.filter((booking) => booking.paymentStatus === 'Paid').length}</b><span>Paid · slot occupied</span></div>`;
    bookings.forEach((booking) => {
      const tr = document.createElement('tr');
      const customer = document.createElement('td'); customer.innerHTML = '<strong></strong><small></small>'; customer.querySelector('strong').textContent = booking.name; customer.querySelector('small').textContent = booking.id.slice(0, 8); tr.append(customer);
      const slot = document.createElement('td'); slot.innerHTML = '<strong></strong><small></small>'; slot.querySelector('strong').textContent = booking.activity; slot.querySelector('small').textContent = `${booking.date} · ${booking.time}`; tr.append(slot);
      const contact = document.createElement('td'); contact.innerHTML = '<a></a><small></small>'; contact.querySelector('a').href = `tel:${booking.phone}`; contact.querySelector('a').textContent = booking.phone; contact.querySelector('small').textContent = booking.email; tr.append(contact);
      tr.append(cell(booking.payment));
      const bookingStatus = document.createElement('td'); const bookingBadge = document.createElement('span'); bookingBadge.className = 'status ' + (booking.paymentStatus === 'Paid' ? 'status-confirmed' : 'status-pending-payment'); bookingBadge.textContent = booking.status; bookingStatus.append(bookingBadge); tr.append(bookingStatus);
      const paymentStatus = document.createElement('td'); const paymentBadge = document.createElement('span'); paymentBadge.className = 'status ' + (booking.paymentStatus === 'Paid' ? 'status-confirmed' : 'status-pending-payment'); paymentBadge.textContent = booking.paymentStatus; paymentStatus.append(paymentBadge); tr.append(paymentStatus);
      const actions = document.createElement('td');
      if (booking.paymentStatus !== 'Paid') {
        actions.append(actionButton('Mark paid', 'mark-paid-button', async () => {
          try { await requestJson(`/api/staff/bookings/${encodeURIComponent(booking.id)}/paid`, { method: 'POST' }); await render(); }
          catch (error) { window.alert(error.message); }
        }));
      }
      actions.append(actionButton('Remove', 'remove-booking-button', async () => {
        if (!window.confirm(`Remove the booking for ${booking.name} on ${booking.date} at ${booking.time}?`)) return;
        try { await requestJson(`/api/staff/bookings/${encodeURIComponent(booking.id)}`, { method: 'DELETE' }); await render(); }
        catch (error) { window.alert(error.message); }
      }));
      tr.append(actions); rows.append(tr);
    });
  } catch (error) {
    if (error.message.includes('Sign in')) { showDashboard(false); return; }
    empty.hidden = false; empty.textContent = error.message;
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = loginForm.querySelector('[type="submit"]'); submit.disabled = true;
  const form = new FormData(loginForm);
  try {
    await requestJson('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
    loginMessage.textContent = ''; loginForm.reset(); showDashboard(true);
  } catch (error) { loginMessage.textContent = error.message; }
  finally { submit.disabled = false; }
});
document.getElementById('logoutButton').addEventListener('click', async () => {
  try { await requestJson('/api/auth/logout', { method: 'POST' }); } catch { /* Clear the local view even if the network is unavailable. */ }
  showDashboard(false);
});
requestJson('/api/auth/session').then(() => showDashboard(true)).catch(() => showDashboard(false));
