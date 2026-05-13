# Lead Management Platform

Internal multi-ICP lead organization, tracking, KPI, and outreach tool. Built from `Lead_Management_Platform_PRD.docx`, plus extensions: per-ICP playbooks, multi-channel outreach tracking, in-app notifications fan-out, role-editable permissions, and exportable reports.

## Stack

- **Next.js 15** (App Router, Server Components, Server Actions) + TypeScript
- **Tailwind CSS** + lucide-react icons
- **MySQL 8+** (InnoDB) via Prisma — native `JSON` columns for filters, prefs, payloads, etc.
- **Auth.js v5** with email/password (Credentials provider)
- **Local filesystem** for playbook uploads (under `./uploads/`)

## Local development

Prereqs: **Node.js 20+** and a **MySQL 8+** server. Create a database (utf8mb4), then copy [`.env.example`](.env.example) to `.env` and set `DATABASE_URL`.

```bash
npm install
npx prisma migrate dev                     # applies migrations to your MySQL DB
npm run db:seed                            # admin/manager/rep users + 5 ICPs
npm run dev                                # http://localhost:3000
```

**Default seeded logins:**

| Role    | Email                 | Password       |
|---------|-----------------------|----------------|
| Admin   | admin@example.com     | ChangeMe123!   |
| Manager | manager@example.com   | ChangeMe123!   |
| Rep     | rep@example.com       | ChangeMe123!   |

**After any schema change, restart the dev server** so the regenerated Prisma client is picked up.

## Feature map

| Area | Where |
|---|---|
| Auth + RBAC | [src/auth.ts](src/auth.ts), [src/lib/rbac.ts](src/lib/rbac.ts) |
| Editable permissions matrix | [/settings/permissions](src/app/(app)/settings/permissions/) |
| ICPs + 4-step builder | [/icps](src/app/(app)/icps/) |
| Lead module | [/leads](src/app/(app)/leads/) |
| Lead scoring engine | [src/lib/scoring.ts](src/lib/scoring.ts) |
| Multi-channel outreach | Outreach tab on lead detail; [src/lib/outreach.ts](src/lib/outreach.ts) |
| Per-ICP playbook (decks, templates, scripts, SOPs, contracts, pricing) | [/playbooks](src/app/(app)/playbooks/) |
| Saved views | [/views](src/app/(app)/views/) |
| KPI dashboard | [/dashboard](src/app/(app)/dashboard/page.tsx) |
| Reports (per-rep, per-ICP, source ROI, funnel, channel reply rates) | [/reports](src/app/(app)/reports/) |
| In-app notifications + fan-out | [src/lib/notify.ts](src/lib/notify.ts) |
| User mgmt + profile + password + notif prefs | [/settings](src/app/(app)/settings/) |
| CSV export | [/api/export/leads](src/app/api/export/leads/route.ts) |

## Production deployment

The database lives on **MySQL** (managed RDS, PlanetScale, Cloud SQL, a VPS install, etc.). The app is still **stateful on disk** for **uploaded playbook files** under `./uploads/` — use a host with a persistent volume for that folder (or move uploads to object storage).

### What works

| Host | Notes |
|---|---|
| Any VPS + MySQL | Run MySQL locally or point `DATABASE_URL` at a managed instance; PM2/systemd for Next. |
| Railway / Render / Fly.io | Use their MySQL add-on or external DB; attach a **volume** for `./uploads/`. |
| Self-hosted Docker | Container for app + separate MySQL service or external `DATABASE_URL`; mount volume for `/app/uploads`. |

### What does **not** work without changes

- **Vercel / Netlify / Cloudflare Pages** — the **filesystem** for `./uploads/` is not durable across invocations. The **MySQL** part is fine if you use a hosted database. To go fully serverless you still need to move uploads to S3-compatible storage and adjust [src/lib/storage.ts](src/lib/storage.ts).

### Deployment steps (generic)

```bash
# 1. Build
npm install
npx prisma migrate deploy           # applies migrations against $DATABASE_URL
npm run build

# 2. Start
npm run start                       # listens on PORT (default 3000)
```

For your **first deploy on a fresh box**, also seed:
```bash
npm run db:seed                     # creates admin user — change the password immediately
```

### Required environment variables

```bash
# Generate a real secret:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

DATABASE_URL="mysql://user:pass@db-host:3306/leadgen"   # MySQL connection string
AUTH_SECRET="<output from node -e ... above>"
AUTH_URL="https://leads.yourcompany.com"        # your real domain, https
```

(Optional) override the seeded admin:
```bash
SEED_ADMIN_EMAIL="you@yourcompany.com"
SEED_ADMIN_PASSWORD="<a temporary strong password>"
```

### Reverse proxy / HTTPS

Run Next behind nginx or Caddy with TLS termination. Forward all traffic to `localhost:3000`. Example Caddy:
```
leads.yourcompany.com {
  reverse_proxy localhost:3000
}
```

### Backups

Use **logical dumps** of MySQL plus your upload directory:
```bash
# Example: mysqldump nightly (adjust user/host/db); keep uploads in sync separately
0 2 * * * mysqldump -h 127.0.0.1 -u backup_user -p'***' leadgen > /backups/leadgen.$(date +\%F).sql
```
Don't forget `./uploads/` — back that up the same way (tar/rsync to object storage, etc.).

### Hardening checklist

- [ ] `AUTH_SECRET` is unique to production (never committed)
- [ ] `AUTH_URL` matches the real https URL
- [ ] Seeded admin password has been changed via [/settings/password](src/app/(app)/settings/password/)
- [ ] Sensitive env vars are not logged
- [ ] MySQL is backed up (`mysqldump` or provider snapshots) and `uploads/` is on persistent, backed-up storage
- [ ] HTTPS is enforced at the proxy
- [ ] System time is correct (notifications + KPIs depend on it)

## Switching database provider

The schema targets **MySQL** today. To use **PostgreSQL** instead: change `provider` in [prisma/schema.prisma](prisma/schema.prisma), set a `postgresql://…` URL, run a new migration baseline or `prisma db push` on a fresh database, and re-test JSON fields (Prisma `Json` works on Postgres too; [src/lib/json.ts](src/lib/json.ts) stays useful for normalizing values).

## Scripts

```
npm run dev          # dev server (Turbopack-free for now)
npm run build        # production build
npm run start        # serve production build
npm run db:migrate   # prisma migrate dev (interactive)
npm run db:reset     # blow away the DB
npm run db:seed      # seed admin/manager/rep + 5 placeholder ICPs
npm run db:studio    # Prisma Studio for browsing rows
```

## Roadmap

What's done:

- ✅ Phase 1 — playbooks (per-ICP decks, templates, scripts, SOPs, contracts, pricing)
- ✅ Phase 2 — multi-channel outreach tracking + channel coverage
- ✅ Phase 3 — notification fan-out + bell + feed
- ✅ Phase 4 — KPI dashboard + reports + CSV export
- ✅ Saved views (private + team-shared)
- ✅ Editable role permissions matrix

What's deferred:

- Email digest delivery (PRD §14.2 daily digest) — schema/prefs in place, no SMTP wired
- CSV import wizard (PRD §13.4)
- Stalled-lead background job (PRD §10.4) — thresholds in DB, no scheduler running
- AI-assisted scoring (PRD Phase 3)
- 2-way Apollo / LinkedIn integration (PRD Phase 2)
