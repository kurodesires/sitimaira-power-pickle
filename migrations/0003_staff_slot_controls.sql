CREATE TABLE IF NOT EXISTS slot_controls (
  activity TEXT NOT NULL CHECK (activity IN ('Pickleball', 'Billiards')),
  booking_date TEXT NOT NULL,
  start_hour INTEGER NOT NULL CHECK (start_hour >= 6 AND start_hour < 19),
  is_available INTEGER NOT NULL DEFAULT 0 CHECK (is_available IN (0, 1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (activity, booking_date, start_hour)
);
