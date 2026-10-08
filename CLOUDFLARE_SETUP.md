# Cloudflare Pages backend setup

The site uses Pages Functions in `functions/` and a D1 database. Do not put staff credentials in JavaScript or commit local secret files.

## 1. Create and bind D1

1. In Cloudflare, create a D1 database for this project.
2. In the Pages project, open **Settings → Bindings → Add → D1 database binding**.
3. Set the variable name to `DB`, select the database, save, and redeploy.
4. Apply `migrations/0001_create_bookings.sql` to the D1 database using its console or Wrangler.

## 2. Add encrypted secrets

In the Pages project, open **Settings → Variables and Secrets** and add these as encrypted secrets for Production (and Preview if you use preview deployments):

- `STAFF_USERNAME` — the staff login username.
- `STAFF_PASSWORD` — choose a new, strong password. Do not reuse the former browser-side password.
- `SESSION_SECRET` — a randomly generated secret of at least 32 random bytes, used to sign eight-hour staff sessions.

After adding or changing bindings and secrets, redeploy the Pages project.

## 3. Deploy from GitHub

The repository root contains `index.html` and the `functions/` directory. Connect the repository to Cloudflare Pages with production branch `main`, no framework preset, build command `exit 0`, and output directory `.`. Pages discovers the Functions from the root-level `functions/` directory.

## API behavior

- `GET /api/availability` returns paid slot times only.
- `POST /api/bookings` validates booking fields and saves an unpaid request. The server calculates the price.
- `POST /api/auth/login` validates credentials on the server and sets a signed, HttpOnly, Secure, SameSite=Strict cookie.
- `GET /api/staff/bookings`, `POST /api/staff/bookings/:id/paid`, and `DELETE /api/staff/bookings/:id` require that staff session.
- Marking a booking paid atomically confirms the booking and reserves its slot. D1 also has a unique partial index that prevents two paid bookings for one activity/date/hour.

The current payment flow still requires staff to verify transfers and click **Mark paid**. A payment provider webhook can replace that manual action after provider credentials and webhook verification are configured.
