const form = document.getElementById('bookingForm');
const dateInput = document.getElementById('bookingDate');
const activity = document.getElementById('activity');
const timeGrid = document.getElementById('timeGrid');
const message = document.getElementById('formMessage');
const calendarDays = document.getElementById('calendarDays');
const monthLabel = document.getElementById('monthLabel');
const courtName = document.getElementById('courtName');
const scheduleNote = document.getElementById('scheduleNote');
const rates = { Pickleball: 300, Billiards: 100 };
const today = new Date();
const todayString = toDateString(today);
let monthCursor = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedTime = '';
let slotRequest = 0;

async function showPayMongoReturn() {
  const params = new URLSearchParams(window.location.search);
  const outcome = params.get('paymongo');
  const bookingId = params.get('booking');
  if (!outcome || !bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) return;
  if (outcome === 'cancelled') {
    try {
      const booking = await (await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, { cache: 'no-store' })).json();
      message.textContent = 'Checkout was cancelled. Your slot is still open. ';
      if (booking.checkoutUrl) {
        const retry = document.createElement('a'); retry.href = booking.checkoutUrl; retry.textContent = 'Return to secure checkout';
        message.append(retry);
      }
    } catch { message.textContent = 'Checkout was cancelled. Your slot is still open.'; }
    return;
  }
  if (outcome !== 'return') return;
  message.textContent = 'Checking the payment with PayMongo…';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, { cache: 'no-store' });
      const booking = await response.json();
      if (response.ok && booking.paymentStatus === 'Paid') {
        message.textContent = booking.status === 'Confirmed'
          ? 'Payment received and booking confirmed. See you at the venue!'
          : 'Payment received. Your booking is awaiting admin approval; the slot is not reserved until it is confirmed.';
        message.classList.add('success');
        return;
      }
    } catch { /* Retry briefly while PayMongo sends the verified webhook. */ }
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
  }
  message.textContent = 'PayMongo has not confirmed this payment yet. Please do not pay again; contact the venue if it remains pending.';
}

function toDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function fromDateString(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
function hourLabel(hour) { if (hour === 24) return '12am'; return `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`; }

function drawCalendar() {
  monthLabel.textContent = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  calendarDays.replaceChildren();
  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const dayString = toDateString(day);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'calendar-day'; button.textContent = String(day.getDate());
    if (day.getMonth() !== monthCursor.getMonth()) button.classList.add('other-month');
    if (dayString === todayString) button.classList.add('today');
    if (dayString === dateInput.value) button.classList.add('selected');
    button.disabled = dayString < todayString;
    button.setAttribute('aria-label', day.toLocaleDateString(undefined, { dateStyle: 'full' }));
    button.setAttribute('aria-selected', dayString === dateInput.value ? 'true' : 'false');
    button.addEventListener('click', () => {
      dateInput.value = dayString; monthCursor = new Date(day.getFullYear(), day.getMonth(), 1);
      message.textContent = ''; message.classList.remove('success'); drawCalendar(); drawSlots();
    });
    calendarDays.append(button);
  }
  document.getElementById('prevMonth').disabled = monthCursor.getFullYear() === today.getFullYear() && monthCursor.getMonth() <= today.getMonth();
}

async function drawSlots({ keepSelection = false } = {}) {
  const previouslySelected = keepSelection ? selectedTime : '';
  selectedTime = '';
  const requestId = ++slotRequest;
  const selectedDate = dateInput.value;
  const currentActivity = activity.value;
  const rate = rates[currentActivity];
  let bookedTimes = new Set();
  let workerUnavailableTimes = new Set();
  let availabilityReady = false;
  if (currentActivity && selectedDate) {
    try {
      const response = await fetch(`/api/availability?date=${encodeURIComponent(selectedDate)}&activity=${encodeURIComponent(currentActivity)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Availability is unavailable.');
      bookedTimes = new Set(data.bookedTimes);
      workerUnavailableTimes = new Set(data.unavailableTimes);
      availabilityReady = true;
      scheduleNote.textContent = selectedDate === todayString
        ? 'Business hours are 8:00 AM to 12:00 AM. Past hours are closed; unpaid requests do not reserve a slot.'
        : 'Open hours are 8:00 AM to 12:00 AM. Payment and admin approval are both required to confirm a slot.';
    } catch (error) {
      scheduleNote.textContent = `${error.message} Please refresh or try again.`;
    }
  }
  if (requestId !== slotRequest) return;
  courtName.textContent = currentActivity === 'Billiards' ? 'Table 1' : 'Court 1';
  timeGrid.replaceChildren();
  for (let hour = 8; hour < 24; hour += 1) {
    const time = `${hour % 12 || 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
    const endTime = hourLabel(hour + 1);
    const paidBooking = bookedTimes.has(time);
    const staffClosed = workerUnavailableTimes.has(time);
    const isPastDate = selectedDate < todayString;
    const isPastHour = selectedDate === todayString && hour <= today.getHours();
    let state = availabilityReady ? 'open' : 'unavailable';
    if (paidBooking) state = 'booked';
    else if (staffClosed) state = 'staff-closed';
    else if (isPastDate || isPastHour) state = 'past';

    const button = document.createElement('button');
    button.type = 'button'; button.className = `time-slot schedule-slot ${state}`;
    button.disabled = state !== 'open';
    const range = document.createElement('span'); range.className = 'slot-range';
    range.innerHTML = `<strong>${hourLabel(hour)}</strong><span>to</span><strong>${endTime}</strong><em>₱${rate}</em>`;
    const status = document.createElement('span'); status.className = 'slot-status';
    status.textContent = state === 'booked' ? '✓ Booked' : state === 'staff-closed' ? 'Unavailable' : state === 'past' ? 'Past' : state === 'unavailable' ? 'Unavailable' : 'Open';
    button.append(range, status);
    button.setAttribute('aria-label', `${hourLabel(hour)} to ${endTime}, ${state}${state === 'open' ? `, ${rate} pesos` : ''}`);
    button.addEventListener('click', () => {
      timeGrid.querySelectorAll('.time-slot').forEach((item) => item.classList.remove('selected'));
      button.classList.add('selected'); selectedTime = time; message.textContent = '';
    });
    if (previouslySelected === time && state === 'open') {
      button.classList.add('selected');
      selectedTime = time;
    } else if (previouslySelected === time && state !== 'open') {
      message.textContent = 'That time just became unavailable. Please choose another open hour.';
      message.classList.remove('success');
    }
    timeGrid.append(button);
  }
  scheduleNote.textContent = selectedDate === todayString
    ? 'Business hours are 8:00 AM to 12:00 AM. Past hours are closed; unpaid requests do not reserve a slot.'
    : 'Open hours are 8:00 AM to 12:00 AM. Payment and admin approval are both required to confirm a slot.';
}

dateInput.value = todayString;
document.getElementById('prevMonth').addEventListener('click', () => {
  monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1); drawCalendar();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1); drawCalendar();
});
activity.addEventListener('change', drawSlots);
drawCalendar(); drawSlots();
window.setInterval(() => {
  if (document.visibilityState === 'visible' && activity.value && dateInput.value) drawSlots({ keepSelection: true });
}, 20000);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedTime) { message.textContent = 'Please choose an open hour.'; return; }
  const fd = new FormData(form);
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    const response = await fetch('/api/bookings', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'), activity: fd.get('activity'), date: fd.get('date'), time: selectedTime, paymentMethod: fd.get('payment') }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save the booking.');
    if (data.checkoutUrl) { window.location.assign(data.checkoutUrl); return; }
    message.textContent = `Booking request saved, ${String(fd.get('name')).trim()}. Your ${String(fd.get('activity'))} request for ${String(fd.get('date'))} at ${selectedTime} is pending payment verification and admin approval. The slot stays open until both are complete.`;
    message.classList.add('success'); form.reset(); activity.value = 'Pickleball'; selectedTime = ''; dateInput.value = todayString; monthCursor = new Date(today.getFullYear(), today.getMonth(), 1); drawCalendar(); await drawSlots();
  } catch (error) {
    message.textContent = error.message;
    message.classList.remove('success');
    if (error.message.toLowerCase().includes('paid')) await drawSlots();
  } finally { submitButton.disabled = false; }
});

showPayMongoReturn();
