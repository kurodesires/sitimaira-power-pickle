ALTER TABLE bookings ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'Pending'
  CHECK (approval_status IN ('Pending', 'Approved'));

UPDATE bookings
SET approval_status = 'Approved'
WHERE payment_status = 'Paid' AND booking_status = 'Confirmed';

DROP INDEX IF EXISTS one_paid_booking_per_slot;

CREATE UNIQUE INDEX IF NOT EXISTS one_paid_approved_booking_per_slot
ON bookings (activity, booking_date, start_hour)
WHERE payment_status = 'Paid' AND approval_status = 'Approved';
