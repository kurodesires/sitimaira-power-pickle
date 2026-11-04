CREATE TABLE walkin_blocks_new (
  id TEXT PRIMARY KEY,
  activity TEXT NOT NULL CHECK (activity IN ('Pickleball', 'Billiards')),
  booking_date TEXT NOT NULL,
  start_minute INTEGER NOT NULL CHECK (start_minute >= 480 AND start_minute < 1440),
  end_minute INTEGER NOT NULL CHECK (end_minute > start_minute AND end_minute <= 1440),
  created_at TEXT NOT NULL
);

INSERT INTO walkin_blocks_new (id, activity, booking_date, start_minute, end_minute, created_at)
SELECT id,
       activity,
       booking_date,
       CASE WHEN start_minute < 480 THEN 480 ELSE start_minute END,
       CASE WHEN end_minute > 1440 THEN 1440 ELSE end_minute END,
       created_at
FROM walkin_blocks
WHERE end_minute > 480 AND start_minute < 1440;

DROP TABLE walkin_blocks;
ALTER TABLE walkin_blocks_new RENAME TO walkin_blocks;
