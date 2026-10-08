const STORE = 'sitimaira-bookings-v1';
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

function toDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function fromDateString(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
function readBookings() { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; } }
function hourLabel(hour) { return `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`; }

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

function drawSlots() {
  selectedTime = '';
  const records = readBookings();
  const selectedDate = dateInput.value;
  const currentActivity = activity.value;
  const rate = rates[currentActivity];
  courtName.textContent = currentActivity === 'Billiards' ? 'Table 1' : 'Court 1';
  timeGrid.replaceChildren();
  for (let hour = 6; hour < 23; hour += 1) {
    const time = `${hour % 12 || 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
    const endTime = hourLabel(hour + 1);
    const paidBooking = records.some((booking) => booking.date === selectedDate && booking.activity === currentActivity && booking.time === time && booking.paymentStatus === 'Paid');
    const isClosed = hour >= 19;
    const isPastDate = selectedDate < todayString;
    const isPastHour = selectedDate === todayString && hour <= today.getHours();
    let state = 'open';
    if (isClosed) state = 'closed';
    else if (paidBooking) state = 'booked';
    else if (isPastDate || isPastHour) state = 'past';

    const button = document.createElement('button');
    button.type = 'button'; button.className = `time-slot schedule-slot ${state}`;
    button.disabled = state !== 'open';
    const range = document.createElement('span'); range.className = 'slot-range';
    range.innerHTML = `<strong>${hourLabel(hour)}</strong><span>to</span><strong>${endTime}</strong><em>₱${rate}</em>`;
    const status = document.createElement('span'); status.className = 'slot-status';
    status.textContent = state === 'booked' ? '✓ Booked' : state === 'closed' ? '⚒ Closed' : state === 'past' ? 'Past' : 'Open';
    button.append(range, status);
    button.setAttribute('aria-label', `${hourLabel(hour)} to ${endTime}, ${state}${state === 'open' ? `, ${rate} pesos` : ''}`);
    button.addEventListener('click', () => {
      timeGrid.querySelectorAll('.time-slot').forEach((item) => item.classList.remove('selected'));
      button.classList.add('selected'); selectedTime = time; message.textContent = '';
    });
    timeGrid.append(button);
  }
  scheduleNote.textContent = selectedDate === todayString
    ? 'Past hours are closed. Choose an open time below; unpaid requests do not reserve it.'
    : 'Choose an open time below. The slot becomes booked after payment is recorded.';
}

dateInput.value = todayString;
document.getElementById('prevMonth').addEventListener('click', () => {
  monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1); drawCalendar();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1); drawCalendar();
});
activity.addEventListener('change', drawSlots);
window.addEventListener('storage', (event) => { if (event.key === STORE) drawSlots(); });
drawCalendar(); drawSlots();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!selectedTime) { message.textContent = 'Please choose an open hour.'; return; }
  const fd = new FormData(form);
  const records = readBookings();
  if (records.some((booking) => booking.date === dateInput.value && booking.activity === activity.value && booking.time === selectedTime && booking.paymentStatus === 'Paid')) {
    message.textContent = 'That slot was just paid for. Please choose another time.'; drawSlots(); return;
  }
  const record = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name: String(fd.get('name')).trim(), phone: String(fd.get('phone')).trim(), email: String(fd.get('email')).trim(), activity: String(fd.get('activity')), date: String(fd.get('date')), time: selectedTime, payment: String(fd.get('payment')), amount: rates[activity.value], status: 'Awaiting payment', paymentStatus: 'Unpaid', createdAt: new Date().toISOString() };
  records.push(record); localStorage.setItem(STORE, JSON.stringify(records));
  message.textContent = `Booking request saved, ${record.name}. Your ${record.activity} slot on ${record.date} at ${record.time} remains open until payment is received.`;
  message.classList.add('success'); form.reset(); activity.value = 'Pickleball'; selectedTime = ''; dateInput.value = todayString; monthCursor = new Date(today.getFullYear(), today.getMonth(), 1); drawCalendar(); drawSlots();
});
