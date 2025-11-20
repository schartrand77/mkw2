MakerWorks v2 - self-hosted 3D print hub

MakerWorks v2 is a self-hosted library for sharing printable models, estimating print jobs, and (optionally) taking payments. This guide is aimed at Unraid Community Applications users.

What you get
- Upload STL/OBJ/3MF files with optional cover images; STL files preview in-browser.
- Automatic weight and cost estimator with material and color options; Stripe checkout stays inside the app when enabled.
- Personal profile pages (`/u/{slug}`) plus featured models curated by admins.
- Admin dashboard for pricing, site settings, backups, and optional OrderWorks webhook retries.
- Email verification for new signups and a bootstrap admin account set via container variables.

Install on Unraid
1) In Community Applications go to Settings > Additional Repositories and add `https://raw.githubusercontent.com/schartrand77/mkw2/main/unraid/templates`.
2) Ensure a Postgres 15+ database is reachable. If running it on the same host, create a custom Docker network first: `docker network create makerworks-net`, then place both containers on it.
3) Install MakerWorks v2 from Community Applications.
4) During install fill the required fields:
   - Web Port: keep 3000 unless you prefer another.
   - Storage: persistent path such as `/mnt/user/appdata/makerworks/storage`.
   - DATABASE_URL: connection string to your Postgres instance.
   - BASE_URL: the URL users reach (e.g., `https://makerworks.example.com`).
   - JWT_SECRET: any long random string.
   - ADMIN_EMAIL / ADMIN_PASSWORD: seeds the first admin user on start.
   - Stripe keys (optional): `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to accept payments.
   - SMTP (optional but recommended): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` so verification emails send correctly.
5) Start the container. First boot runs migrations and creates the admin account. Visit `http://<server-ip>:<port>`.

First login & setup
- Sign in with the admin email/password you set; this account is already verified.
- Open Admin > Site Settings to set your shop name, currency, and price adjustments.
- Add spool costs and optional color surcharge rates in Admin > Pricing so estimates match your material costs.
- Connect Stripe in the env vars to enable checkout, or leave blank to use MakerWorks as a catalog only.
- If you use OrderWorks, add the webhook URL/secret in the admin panel to forward new jobs.

Daily use
- Upload models from the Upload page (supports STL, OBJ, 3MF) and optionally add a cover image; STL files render in a 3D viewer.
- Each model gets a shareable page; `/u/{slug}` lists a user's uploads and `/me` jumps to your own page.
- Carts show weight, material choice (PLA/PETG), and estimated time/energy costs; Stripe's Payment Element keeps checkout on-site when configured.
- Users receive a verification link by email and can resend it from the signup screen.

Backups & restore
- In Admin > Backups create a snapshot of the database and uploads; files land under `/files/backups/<timestamp>/` on your storage share.
- Restore from the same card when needed; the app restarts to apply the snapshot. Keep your storage share backed up regularly.

Updating
- In Unraid, stop the container, click Update on MakerWorks v2, then start it again. Data persists through the mapped storage path and your database.

Running without Unraid (optional)
- Copy `.env.example` to `.env`, set the same variables, then run `docker-compose up --build` to start the app and Postgres locally. The app lives at `http://localhost:3000/`.

Support
- Issues and questions: https://github.com/schartrand77/mkw2/issues
