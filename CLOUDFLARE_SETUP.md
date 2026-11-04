# Cloudflare Pages backend setup

The site uses Pages Functions in `functions/` and a D1 database. Do not put staff credentials in JavaScript or commit local secret files.

## 1. Create and bind D1

1. In Cloudflare, create a D1 database for this project.
2. In the Pages project, open **Settings → Bindings → Add → D1 database binding**.
3. Set the variable name to `DB`, select the database, save, and redeploy.
4. For a new database, apply `migrations/0001_create_bookings.sql`, then `migrations/0003_staff_slot_controls.sql`, then `migrations/0004_walkin_time_blocks.sql`. For the existing database created earlier, apply any missing migrations in order: `migrations/0002_require_admin_approval.sql`, `migrations/0003_staff_slot_controls.sql`, then `migrations/0004_walkin_time_blocks.sql`. Do not rerun migrations already applied.

## 2. Add encrypted secrets

In the Pages project, open **Settings → Variables and Secrets** and add these as encrypted secrets for Production (and Preview if you use preview deployments):

- `STAFF_USERNAME` — the staff login username.
- `STAFF_PASSWORD` — choose a new, strong password. Do not reuse the former browser-side password.
- `SESSION_SECRET` — a randomly generated secret of at least 32 random bytes, used to sign eight-hour staff sessions.

After applying the D1 migrations and adding or changing bindings and secrets, redeploy the Pages project.

## 3. Deploy from GitHub

The repository root contains `index.html` and the `functions/` directory. Connect the repository to Cloudflare Pages with production branch `main`, no framework preset, build command `exit 0`, and output directory `.`. Pages discovers the Functions from the root-level `functions/` directory.

## API behavior

- `GET /api/availability` returns online slots occupied after admin approval and payment, plus hours staff marked unavailable for walk-ins.
- `GET/POST/DELETE /api/staff/availability` lets authenticated staff mark custom date/time ranges unavailable for walk-ins. Blocks expire automatically at their end time; confirmed online bookings cannot be blocked.
- `POST /api/bookings` validates booking fields and saves an unpaid request that is pending admin approval. The server calculates the price.
- `POST /api/auth/login` validates credentials on the server and sets a signed, HttpOnly, Secure, SameSite=Strict cookie.
- `GET /api/staff/bookings`, `POST /api/staff/bookings/:id/approve`, `POST /api/staff/bookings/:id/paid`, and `DELETE /api/staff/bookings/:id` require that staff session.
- An admin must approve a booking and staff must verify payment before the booking is confirmed and its slot is reserved. D1 has a unique partial index that prevents two paid and approved bookings for one activity/date/hour.

The current payment flow still requires staff to verify transfers and click **Mark paid**. A payment provider webhook can replace that manual action after provider credentials and webhook verification are configured.
