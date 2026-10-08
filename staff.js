const STORE = 'sitimaira-bookings-v1';
const AUTH = 'sitimaira-staff-session';
const USERNAME = 'sitimairas';
const PASSWORD = 'sitimairaworkeronly';
const loginGate = document.getElementById('loginGate');
const loginForm = document.getElementById('staffLoginForm');
const loginMessage = document.getElementById('loginMessage');
const content = document.getElementById('staffContent');
const rows = document.getElementById('bookingRows');
const empty = document.getElementById('emptyState');
const summary = document.getElementById('staffSummary');
function read() { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; } }
function showDashboard(isLoggedIn) {
  loginGate.hidden = isLoggedIn;
  content.hidden = !isLoggedIn;
  document.title = isLoggedIn ? 'Staff bookings | Sitimaira Power Pickle' : 'Staff login | Sitimaira Power Pickle';
  if (isLoggedIn) render();
}
function cell(text) { const td = document.createElement('td'); td.textContent = text; return td; }
function render() {
  if (sessionStorage.getItem(AUTH) !== 'true') return;
  const list = read().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  rows.replaceChildren(); empty.hidden = list.length > 0;
  summary.innerHTML = `<div><b>${list.length}</b><span>Total booking requests</span></div><div><b>${list.filter(x => x.paymentStatus !== 'Paid').length}</b><span>Unpaid · slot open</span></div><div><b>${list.filter(x => x.paymentStatus === 'Paid').length}</b><span>Paid · slot occupied</span></div>`;
  list.forEach((booking) => {
    const tr = document.createElement('tr');
    const customer = document.createElement('td'); customer.innerHTML = '<strong></strong><small></small>'; customer.querySelector('strong').textContent = booking.name; customer.querySelector('small').textContent = booking.id.slice(0, 8); tr.append(customer);
    const slot = document.createElement('td'); slot.innerHTML = '<strong></strong><small></small>'; slot.querySelector('strong').textContent = booking.activity; slot.querySelector('small').textContent = `${booking.date} · ${booking.time}`; tr.append(slot);
    const contact = document.createElement('td'); contact.innerHTML = '<a></a><small></small>'; contact.querySelector('a').href = `tel:${booking.phone}`; contact.querySelector('a').textContent = booking.phone; contact.querySelector('small').textContent = booking.email; tr.append(contact);
    tr.append(cell(booking.payment));
    const bookingStatus = document.createElement('td'); const bookingBadge = document.createElement('span'); bookingBadge.className = 'status ' + (booking.paymentStatus === 'Paid' ? 'status-confirmed' : 'status-pending-payment'); bookingBadge.textContent = booking.status || 'Awaiting payment'; bookingStatus.append(bookingBadge); tr.append(bookingStatus);
    const paymentStatus = document.createElement('td'); const paymentBadge = document.createElement('span'); paymentBadge.className = 'status ' + (booking.paymentStatus === 'Paid' ? 'status-confirmed' : 'status-pending-payment'); paymentBadge.textContent = booking.paymentStatus || 'Unpaid'; paymentStatus.append(paymentBadge); tr.append(paymentStatus);
    const actions = document.createElement('td');
    if (booking.paymentStatus !== 'Paid') {
      const markPaid = document.createElement('button'); markPaid.type = 'button'; markPaid.className = 'mark-paid-button'; markPaid.textContent = 'Mark paid';
      markPaid.addEventListener('click', () => {
        const current = read();
        const conflict = current.some((item) => item.id !== booking.id && item.activity === booking.activity && item.date === booking.date && item.time === booking.time && item.paymentStatus === 'Paid');
        if (conflict) { window.alert('Another paid booking already occupies this slot. Do not mark this request paid.'); return; }
        localStorage.setItem(STORE, JSON.stringify(current.map((item) => item.id === booking.id ? { ...item, status: 'Confirmed', paymentStatus: 'Paid' } : item)));
        render();
      });
      actions.append(markPaid);
    }
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-booking-button'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      if (!window.confirm(`Remove the booking for ${booking.name} on ${booking.date} at ${booking.time}?`)) return;
      localStorage.setItem(STORE, JSON.stringify(read().filter((item) => item.id !== booking.id)));
      render();
    });
    actions.append(remove); tr.append(actions); rows.append(tr);
  });
}
loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  if (form.get('username') === USERNAME && form.get('password') === PASSWORD) {
    sessionStorage.setItem(AUTH, 'true'); loginMessage.textContent = ''; loginForm.reset(); showDashboard(true);
  } else { loginMessage.textContent = 'Username or password is incorrect.'; }
});
document.getElementById('logoutButton').addEventListener('click', () => { sessionStorage.removeItem(AUTH); showDashboard(false); });
window.addEventListener('storage', (event) => { if (event.key === STORE) render(); });
showDashboard(sessionStorage.getItem(AUTH) === 'true');
