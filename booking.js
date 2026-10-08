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

function toDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function fromDateString(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
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

async function drawSlots() {
  selectedTime = '';
  const requestId = ++slotRequest;
  const selectedDate = dateInput.value;
  const currentActivity = activity.value;
  const rate = rates[currentActivity];
  let bookedTimes = new Set();
  let availabilityReady = false;
  if (currentActivity && selectedDate) {
    try {
      const response = await fetch(`/api/availability?date=${encodeURIComponent(selectedDate)}&activity=${encodeURIComponent(currentActivity)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Availability is unavailable.');
      bookedTimes = new Set(data.bookedTimes);
      availabilityReady = true;
      scheduleNote.textContent = selectedDate === todayString
        ? 'Past hours are closed. Choose an open time below; unpaid requests do not reserve it.'
        : 'Choose an open time below. The slot becomes booked after payment is recorded.';
    } catch (error) {
      scheduleNote.textContent = `${error.message} Please refresh or try again.`;
    }
  }
  if (requestId !== slotRequest) return;
  courtName.textContent = currentActivity === 'Billiards' ? 'Table 1' : 'Court 1';
  timeGrid.replaceChildren();
  for (let hour = 6; hour < 23; hour += 1) {
    const time = `${hour % 12 || 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
    const endTime = hourLabel(hour + 1);
    const paidBooking = bookedTimes.has(time);
    const isClosed = hour >= 19;
    const isPastDate = selectedDate < todayString;
    const isPastHour = selectedDate === todayString && hour <= today.getHours();
    let state = availabilityReady ? 'open' : 'unavailable';
    if (isClosed) state = 'closed';
    else if (paidBooking) state = 'booked';
    else if (isPastDate || isPastHour) state = 'past';

    const button = document.createElement('button');
    button.type = 'button'; button.className = `time-slot schedule-slot ${state}`;
    button.disabled = state !== 'open';
    const range = document.createElement('span'); range.className = 'slot-range';
    range.innerHTML = `<strong>${hourLabel(hour)}</strong><span>to</span><strong>${endTime}</strong><em>₱${rate}</em>`;
    const status = document.createElement('span'); status.className = 'slot-status';
    status.textContent = state === 'booked' ? '✓ Booked' : state === 'closed' ? '⚒ Closed' : state === 'past' ? 'Past' : state === 'unavailable' ? 'Unavailable' : 'Open';
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
drawCalendar(); drawSlots();

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
    message.textContent = `Booking request saved, ${String(fd.get('name')).trim()}. Your ${String(fd.get('activity'))} slot on ${String(fd.get('date'))} at ${selectedTime} remains open until payment is received.`;
    message.classList.add('success'); form.reset(); activity.value = 'Pickleball'; selectedTime = ''; dateInput.value = todayString; monthCursor = new Date(today.getFullYear(), today.getMonth(), 1); drawCalendar(); await drawSlots();
  } catch (error) {
    message.textContent = error.message;
    message.classList.remove('success');
    if (error.message.toLowerCase().includes('paid')) await drawSlots();
  } finally { submitButton.disabled = false; }
});
