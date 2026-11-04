const loginGate = document.getElementById('loginGate');
const loginForm = document.getElementById('staffLoginForm');
const loginMessage = document.getElementById('loginMessage');
const content = document.getElementById('staffContent');
const rows = document.getElementById('bookingRows');
const empty = document.getElementById('emptyState');
const summary = document.getElementById('staffSummary');
const adminDate = document.getElementById('adminDate');
const adminMonthLabel = document.getElementById('adminMonthLabel');
const adminCalendarDays = document.getElementById('adminCalendarDays');
const adminSelectedDateLabel = document.getElementById('adminSelectedDateLabel');
const walkinStartOptions = document.getElementById('walkinStartOptions');
const walkinEndOptions = document.getElementById('walkinEndOptions');
const adminActivity = document.getElementById('adminActivity');
const adminSlotGrid = document.getElementById('adminSlotGrid');
const walkinBlockForm = document.getElementById('walkinBlockForm');
const walkinBlockList = document.getElementById('walkinBlockList');
const availabilityMessage = document.getElementById('adminAvailabilityMessage');
const removeBookingDialog = document.getElementById('removeBookingDialog');
const removeDialogMessage = document.getElementById('removeDialogMessage');
let authenticated = false;
let adminMonthCursor = new Date();

function confirmBookingRemoval(booking) {
  removeDialogMessage.textContent = `Remove the booking for ${booking.name} on ${booking.date} at ${booking.time}? This action cannot be undone.`;
  removeBookingDialog.showModal();
  return new Promise((resolve) => {
    removeBookingDialog.addEventListener('close', () => resolve(removeBookingDialog.returnValue === 'confirm'), { once: true });
  });
}

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
  document.title = isLoggedIn ? 'Admin bookings | Sitimaira Power Smash' : 'Admin login | Sitimaira Power Smash';
  if (isLoggedIn) { render(); renderAvailability(); }
}
function hourLabel(hour) { if (hour === 24) return '12am'; return `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`; }
function minuteLabel(total) { const hour = Math.floor(total / 60); const minute = total % 60; if (total === 1440) return '12:00 AM'; return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`; }
function dateToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function dateFromString(value) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); }
function dateLabel(value) { return dateFromString(value).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
function minuteTime(value) { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; }
function valueTime(total) { return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; }
function cell(text) { const td = document.createElement('td'); td.textContent = text ?? ''; return td; }
function actionButton(label, className, handler) {
  const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = label;
  button.addEventListener('click', handler); return button;
}
function drawAdminCalendar() {
  if (!adminDate.value) adminDate.value = dateToday();
  adminMonthLabel.textContent = adminMonthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  adminSelectedDateLabel.textContent = dateLabel(adminDate.value);
  adminCalendarDays.replaceChildren();
  const first = new Date(adminMonthCursor.getFullYear(), adminMonthCursor.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  const today = dateToday();
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'admin-calendar-day'; button.textContent = String(date.getDate());
    if (date.getMonth() !== adminMonthCursor.getMonth()) button.classList.add('outside-month');
    if (value === today) button.classList.add('is-today');
    if (value === adminDate.value) button.classList.add('is-selected');
    button.disabled = value < today;
    button.setAttribute('aria-label', date.toLocaleDateString(undefined, { dateStyle: 'full' }));
    button.setAttribute('aria-selected', value === adminDate.value ? 'true' : 'false');
    if (value === today) button.setAttribute('aria-current', 'date');
    button.addEventListener('click', () => {
      adminDate.value = value;
      adminMonthCursor = new Date(date.getFullYear(), date.getMonth(), 1);
      drawAdminCalendar(); renderAvailability();
    });
    adminCalendarDays.append(button);
  }
  document.getElementById('adminPrevMonth').disabled = adminMonthCursor.getFullYear() === new Date().getFullYear() && adminMonthCursor.getMonth() <= new Date().getMonth();
}

function drawTimeChoices() {
  const now = new Date();
  const startFloor = adminDate.value === dateToday() ? (Math.floor((now.getHours() * 60 + now.getMinutes()) / 30) + 1) * 30 : 480;
  let selectedStart = minuteTime(document.getElementById('walkinStart').value);
  let selectedEnd = minuteTime(document.getElementById('walkinEnd').value);
  if (selectedStart < startFloor || selectedStart < 480 || selectedStart >= 1440) selectedStart = Math.min(Math.max(startFloor, 480), 1410);
  if (selectedEnd <= selectedStart || selectedEnd > 1440) selectedEnd = Math.min(selectedStart + 60, 1440);
  document.getElementById('walkinStart').value = valueTime(selectedStart);
  document.getElementById('walkinEnd').value = valueTime(selectedEnd);
  walkinStartOptions.replaceChildren(); walkinEndOptions.replaceChildren();
  for (let minute = 480; minute <= 1410; minute += 30) {
    const start = actionButton(minuteLabel(minute), `time-choice${minute === selectedStart ? ' selected' : ''}`, () => {
      document.getElementById('walkinStart').value = valueTime(minute);
      if (selectedEnd <= minute) document.getElementById('walkinEnd').value = valueTime(Math.min(minute + 60, 1440));
      drawTimeChoices();
    });
    start.disabled = minute < startFloor;
    start.setAttribute('aria-pressed', minute === selectedStart ? 'true' : 'false');
    walkinStartOptions.append(start);
  }
  for (let minute = 510; minute <= 1440; minute += 30) {
    const end = actionButton(minuteLabel(minute), `time-choice${minute === selectedEnd ? ' selected' : ''}`, () => {
      document.getElementById('walkinEnd').value = valueTime(minute); drawTimeChoices();
    });
    end.disabled = minute <= selectedStart;
    end.setAttribute('aria-pressed', minute === selectedEnd ? 'true' : 'false');
    walkinEndOptions.append(end);
  }
}
async function render() {
  if (!authenticated) return;
  try {
    const { bookings } = await requestJson('/api/staff/bookings');
    rows.replaceChildren(); empty.hidden = bookings.length > 0;
    summary.innerHTML = `<div><b>${bookings.length}</b><span>Total booking requests</span></div><div><b>${bookings.filter((booking) => booking.approvalStatus !== 'Approved').length}</b><span>Awaiting admin approval</span></div><div><b>${bookings.filter((booking) => booking.status === 'Confirmed').length}</b><span>Confirmed · slot occupied</span></div>`;
    bookings.forEach((booking) => {
      const tr = document.createElement('tr');
      const customer = document.createElement('td'); customer.innerHTML = '<strong></strong><small></small>'; customer.querySelector('strong').textContent = booking.name; customer.querySelector('small').textContent = booking.id.slice(0, 8); tr.append(customer);
      const slot = document.createElement('td'); slot.innerHTML = '<strong></strong><small></small>'; slot.querySelector('strong').textContent = booking.activity; slot.querySelector('small').textContent = `${booking.date} · ${booking.time}`; tr.append(slot);
      const contact = document.createElement('td'); contact.innerHTML = '<a></a><small></small>'; contact.querySelector('a').href = `tel:${booking.phone}`; contact.querySelector('a').textContent = booking.phone; contact.querySelector('small').textContent = booking.email; tr.append(contact);
      tr.append(cell(booking.payment));
      const approvalCell = document.createElement('td'); const approvalBadge = document.createElement('span'); approvalBadge.className = 'status ' + (booking.approvalStatus === 'Approved' ? 'status-confirmed' : 'status-pending-payment'); approvalBadge.textContent = booking.approvalStatus; approvalCell.append(approvalBadge); tr.append(approvalCell);
      const bookingStatus = document.createElement('td'); const bookingBadge = document.createElement('span'); bookingBadge.className = 'status ' + (booking.status === 'Confirmed' ? 'status-confirmed' : 'status-pending-payment'); bookingBadge.textContent = booking.status; bookingStatus.append(bookingBadge); tr.append(bookingStatus);
      const paymentStatus = document.createElement('td'); const paymentBadge = document.createElement('span'); paymentBadge.className = 'status ' + (booking.paymentStatus === 'Paid' ? 'status-confirmed' : 'status-pending-payment'); paymentBadge.textContent = booking.paymentStatus; paymentStatus.append(paymentBadge); tr.append(paymentStatus);
      const actions = document.createElement('td');
      if (booking.approvalStatus !== 'Approved') {
        actions.append(actionButton('Approve', 'mark-paid-button', async () => {
          try { await requestJson(`/api/staff/bookings/${encodeURIComponent(booking.id)}/approve`, { method: 'POST' }); await render(); }
          catch (error) { window.alert(error.message); }
        }));
      }
      if (booking.paymentStatus !== 'Paid' && booking.paymentProvider !== 'PayMongo') {
        actions.append(actionButton('Mark paid', 'mark-paid-button', async () => {
          try { await requestJson(`/api/staff/bookings/${encodeURIComponent(booking.id)}/paid`, { method: 'POST' }); await render(); }
          catch (error) { window.alert(error.message); }
        }));
      }
      if (booking.paymentStatus !== 'Paid' && booking.paymentProvider === 'PayMongo') {
        const awaiting = document.createElement('small'); awaiting.textContent = 'Awaiting PayMongo webhook'; actions.append(awaiting);
      }
      actions.append(actionButton('Remove', 'remove-booking-button', async () => {
        if (!await confirmBookingRemoval(booking)) return;
        try { await requestJson(`/api/staff/bookings/${encodeURIComponent(booking.id)}`, { method: 'DELETE' }); await render(); }
        catch (error) { window.alert(error.message); }
      }));
      tr.append(actions); rows.append(tr);
    });
  } catch (error) {
    if (error.message.includes('Sign in')) { showDashboard(false); return; }
    rows.replaceChildren(); summary.replaceChildren(); empty.hidden = false; empty.textContent = error.message;
  }
}

async function renderAvailability() {
  if (!authenticated || !adminDate.value) return;
  availabilityMessage.textContent = '';
  adminSlotGrid.replaceChildren();
  try {
    const query = new URLSearchParams({ date: adminDate.value, activity: adminActivity.value });
    const { blocks, bookings } = await requestJson(`/api/staff/availability?${query}`);
    const bookedHours = new Set(bookings.map((booking) => booking.startHour));
    for (let hour = 8; hour < 24; hour += 1) {
      const booked = bookedHours.has(hour);
      const walkinBlocked = blocks.some((block) => block.startMinute < (hour + 1) * 60 && block.endMinute > hour * 60);
      const isPast = adminDate.value < dateToday() || (adminDate.value === dateToday() && (hour + 1) * 60 <= new Date().getHours() * 60 + new Date().getMinutes());
      const available = !booked && !walkinBlocked && !isPast;
      const card = document.createElement('button'); card.type = 'button'; card.className = `admin-slot ${booked ? 'is-booked' : walkinBlocked ? 'is-unavailable' : isPast ? 'is-past' : 'is-open'}`;
      card.disabled = !available;
      const label = document.createElement('div'); label.className = 'admin-slot-label';
      const range = document.createElement('strong'); range.textContent = `${hourLabel(hour)} to ${hourLabel(hour + 1)}`;
      const status = document.createElement('span'); status.textContent = booked ? 'Booked online' : walkinBlocked ? 'Unavailable · walk-in' : isPast ? 'Past' : 'Available · tap to select';
      label.append(range, status);
      card.append(label); adminSlotGrid.append(card);
      card.addEventListener('click', () => {
        document.getElementById('walkinStart').value = valueTime(hour * 60);
        document.getElementById('walkinEnd').value = valueTime((hour + 1) * 60);
        drawTimeChoices();
      });
    }
    walkinBlockList.replaceChildren();
    if (!blocks.length) { walkinBlockList.textContent = 'No active walk-in holds for this date.'; return; }
    blocks.forEach((block) => {
      const item = document.createElement('div'); item.className = 'walkin-block-item';
      const times = document.createElement('span'); times.textContent = `${minuteLabel(block.startMinute)} – ${minuteLabel(block.endMinute)} · automatically reopens at ${minuteLabel(block.endMinute)}`;
      const release = actionButton('Make available now', 'availability-toggle', async () => {
        release.disabled = true;
        try {
          await requestJson('/api/staff/availability', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: block.id }) });
          await renderAvailability();
        } catch (error) { availabilityMessage.textContent = error.message; release.disabled = false; }
      });
      item.append(times, release); walkinBlockList.append(item);
    });
  } catch (error) {
    adminSlotGrid.textContent = error.message;
    walkinBlockList.replaceChildren();
  }
}

adminDate.value = dateToday(); adminMonthCursor = new Date();
drawAdminCalendar(); drawTimeChoices();
document.getElementById('adminPrevMonth').addEventListener('click', () => {
  adminMonthCursor = new Date(adminMonthCursor.getFullYear(), adminMonthCursor.getMonth() - 1, 1); drawAdminCalendar();
});
document.getElementById('adminNextMonth').addEventListener('click', () => {
  adminMonthCursor = new Date(adminMonthCursor.getFullYear(), adminMonthCursor.getMonth() + 1, 1); drawAdminCalendar();
});
document.getElementById('adminToday').addEventListener('click', () => {
  adminDate.value = dateToday(); adminMonthCursor = new Date(); drawAdminCalendar(); drawTimeChoices(); renderAvailability();
});
adminActivity.addEventListener('change', renderAvailability);
walkinBlockForm.addEventListener('submit', async (event) => {
  event.preventDefault(); availabilityMessage.textContent = '';
  const submit = walkinBlockForm.querySelector('[type="submit"]'); submit.disabled = true;
  try {
    await requestJson('/api/staff/availability', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: adminDate.value, activity: adminActivity.value, startTime: document.getElementById('walkinStart').value, endTime: document.getElementById('walkinEnd').value }) });
    await renderAvailability();
  } catch (error) { availabilityMessage.textContent = error.message; }
  finally { submit.disabled = false; }
});
window.setInterval(() => { if (authenticated && document.visibilityState === 'visible') renderAvailability(); }, 30000);

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
