CREATE TABLE IF NOT EXISTS walkin_blocks (
  id TEXT PRIMARY KEY,
  activity TEXT NOT NULL CHECK (activity IN ('Pickleball', 'Billiards')),
  booking_date TEXT NOT NULL,
  start_minute INTEGER NOT NULL CHECK (start_minute >= 360 AND start_minute < 1140),
  end_minute INTEGER NOT NULL CHECK (end_minute > start_minute AND end_minute <= 1140),
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO walkin_blocks (id, activity, booking_date, start_minute, end_minute, created_at)
SELECT activity || ':' || booking_date || ':' || start_hour,
       activity,
       booking_date,
       start_hour * 60,
       (start_hour + 1) * 60,
       updated_at
FROM slot_controls
WHERE is_available = 0;

