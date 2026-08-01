# SEPS

**SEPS** (Simetri ERP Store) — SaaS ERP untuk toko bangunan: POS, inventory, keuangan, laporan multi-cabang.

## Stack

- TanStack Start (SSR) + React 19
- Neon PostgreSQL + Drizzle ORM
- JWT session + Google OAuth
- PWA (offline POS)

## Development lokal

```bash
npm install
cp .env.example .env   # isi DATABASE_URL, AUTH_SECRET, dll.
npm run neon:setup     # sekali: skema + seed
npm run dev            # http://localhost:8081
```

## Deploy staging (Railway)

Lihat **[DEPLOY.md](./DEPLOY.md)** — deploy otomatis dari GitHub push.

```bash
npm run build
npm run start          # production lokal: node .output/server/index.mjs
```

## Scripts

| Command | |
|---------|--|
| `npm run dev` | Dev server |
| `npm run build` | Production build (Nitro node-server) |
| `npm run start` | Jalankan build production |
| `npm run neon:health` | Cek koneksi database |
| `npm run neon:uat` | UAT otomatis |

## Dokumentasi

- `docs/WORKFLOW_GIT.md` — **workflow Git** (lokal → push → deploy, PC ↔ MacBook, pakai analogi)
- `neon/README.md` — setup database
- `DEPLOY.md` — Railway + domain
- `PRD_-_SES_Simetri_ERP_Store.md` — product requirements
