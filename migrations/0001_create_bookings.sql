CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  activity TEXT NOT NULL CHECK (activity IN ('Pickleball', 'Billiards')),
  booking_date TEXT NOT NULL,
  time_label TEXT NOT NULL,
  start_hour INTEGER NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('GCash', 'MariBank')),
  amount INTEGER NOT NULL,
  booking_status TEXT NOT NULL DEFAULT 'Awaiting payment',
  payment_status TEXT NOT NULL DEFAULT 'Unpaid',
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS one_paid_booking_per_slot
ON bookings (activity, booking_date, start_hour)
WHERE payment_status = 'Paid';

CREATE INDEX IF NOT EXISTS bookings_by_date_activity
ON bookings (booking_date, activity, payment_status);
