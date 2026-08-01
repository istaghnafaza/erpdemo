# SEPS — Deploy ke Railway (Staging)

Panduan deploy **SEPS** (Simetri ERP Store) ke Railway + Neon PostgreSQL.

> Repo GitHub saat ini masih `erpdemo` — disarankan buat repo baru **`seps`** atau rename repo di GitHub, lalu connect Railway ke repo tersebut.

---

## Arsitektur

```
Browser → Railway (Node.js SSR) → Neon PostgreSQL (Singapore)
Domain Hostinger (opsional) → CNAME → Railway
```

---

## Prasyarat

1. Akun [Railway](https://railway.app)
2. Project [Neon](https://console.neon.tech) — region **ap-southeast-1**
3. Repo GitHub (push branch `main`)
4. (Opsional) Domain di Hostinger untuk custom URL

---

## 1. Neon — database

1. Buat project Neon → region Singapore
2. Salin connection string ke `.env` lokal, jalankan:

```bash
npm run neon:setup
npm run neon:health
```

3. Simpan `DATABASE_URL` dan `DATABASE_URL_DIRECT` untuk Railway

---

## 2. Railway — deploy dari GitHub

### Buat project

1. Railway → **New Project** → **Deploy from GitHub repo**
2. Pilih repo (disarankan rename/buat repo **`seps`**)
3. Root directory: `/` (root project)

### Environment variables (wajib)

Set di Railway → Service → **Variables**:

| Variable | Contoh / catatan |
|----------|------------------|
| `DATABASE_URL` | `postgresql://...@...neon.tech/neondb?sslmode=require` |
| `DATABASE_URL_DIRECT` | sama atau direct Neon URL |
| `AUTH_SECRET` | string random min 32 karakter |
| `AUTH_URL` | `https://<nama-service>.up.railway.app` (update setelah domain generated) |
| `VITE_DATA_BACKEND` | `neon` |
| `VITE_APP_NAME` | `SEPS` |
| `VITE_APP_ENV` | `staging` |
| `NODE_ENV` | `production` |

### Google OAuth (opsional)

| Variable | |
|----------|--|
| `VITE_GOOGLE_CLIENT_ID` | dari Google Cloud Console |
| `GOOGLE_CLIENT_ID` | sama |
| `GOOGLE_CLIENT_SECRET` | secret OAuth |

Di Google Console, tambahkan:

- **Authorized JavaScript origins:** `https://<railway-url>`
- **Redirect URIs:** `https://<railway-url>/auth/google/callback`

Set `AUTH_URL` = URL Railway **tanpa** trailing slash.

### ⚠️ Penting: jangan redeploy deployment lama

Screenshot/log **8177c477** jam **02:56** = commit **lama** (sebelum patch). Tanda-tandanya:

| Log LAMA (gagal) | Log BARU (benar) |
|------------------|------------------|
| `> vite build` saja | `> node scripts/patch-nf3-nft.mjs && vite build` |
| Tidak ada `[patch-nf3-nft]` | Ada `[patch-nf3-nft] patched nf3...` |
| `stage-0` + `nix-env` + `$NIXPACKS_PATH` | **Docker:** `FROM node:22-bookworm-slim` |

**Redeploy commit terbaru:**

1. Railway → service **erpdemo** → tab **Deployments**
2. Klik deployment **paling atas** (commit `4c78684` atau lebih baru)
3. Jika tidak ada → **Settings → Source** → pastikan branch `main` + repo `istaghnafaza/erpdemo`
4. Klik **Deploy** / tunggu auto-deploy setelah push GitHub
5. **Jangan** klik Redeploy pada deployment lama 02:56

### Build & start

**Opsi A — Dockerfile (disarankan):** Service → **Settings → Build** → Builder = **Dockerfile**, path = `Dockerfile`. Hapus custom Build Command.

**Opsi B — Nixpacks:** Tetap bisa jika commit terbaru — script `patch-nf3-nft` jalan otomatis saat `npm run build`.

- **Start:** `node .output/server/index.mjs`

### Generate domain

Railway → Service → **Settings** → **Networking** → **Generate Domain**

Copy URL → update `AUTH_URL` → redeploy.

---

## 3. Uji staging

1. Buka `https://<railway-url>/login`
2. Register akun baru **atau** login seed (jika sudah di-import Neon):
   - `budi@simetri.id` / `DemoSES2025!`
3. Wizard onboarding → POS → Dashboard

Health check Railway: path **`/pwa-icon.svg`** (file statis, tanpa SSR). Route `/health` tetap ada untuk cek manual.

---

## 4. Update berkala (development)

```bash
git add .
git commit -m "feat: ..."
git push origin main
```

Railway auto-rebuild & redeploy setiap push ke branch yang di-connect.

**Alur disarankan:**

| Branch | Fungsi |
|--------|--------|
| `main` | staging Railway (uji online) |
| `production` | nanti untuk pelanggan SaaS |

Develop lokal tetap: `npm run dev` → `http://localhost:8081`

Panduan lengkap (analogi toko, PC ↔ MacBook, checklist pre-push): **[docs/WORKFLOW_GIT.md](./docs/WORKFLOW_GIT.md)**

---

## 5. Domain custom — `seps.fazagroup.id`

Panduan lengkap: **[DOMAIN_fazagroup.md](./DOMAIN_fazagroup.md)**

Ringkas:

1. Railway → **Networking** → Custom Domain: `seps.fazagroup.id` → salin **CNAME target**
2. Hostinger hPanel → DNS **fazagroup.id** → CNAME `seps` → target Railway
3. Railway Variables → `AUTH_URL=https://seps.fazagroup.id` (+ Neon, `AUTH_SECRET`) — template: `.env.railway.example`
4. Redeploy → uji `https://seps.fazagroup.id/login`

Hostinger **Premium/Business** tetap untuk email & landing `fazagroup.id` — app SEPS di subdomain `seps`.

---

## 6. Troubleshooting

| Gejala | Solusi |
|--------|--------|
| Build gagal `EBUSY node_modules/.cache` | Jangan ulang `npm ci` di build command — Railway sudah install otomatis |
| Healthcheck failure | Cek **Deploy Logs** baris `[SEPS] starting server host=... port=...`; healthcheck pakai `/pwa-icon.svg` |
| 500 saat login | `AUTH_SECRET` & `DATABASE_URL` benar? |
| Google login gagal | `AUTH_URL` match URL browser; redirect URI di Console |
| Data kosong | `VITE_DATA_BACKEND=neon`; jalankan `neon:setup` |
| PWA warning saat build | Aman diabaikan untuk staging |

---

## 7. Biaya perkiraan (merintis)

| Layanan | |
|---------|--|
| Neon Free/Launch | $0–19/bulan |
| Railway Hobby | ~$5/bulan + usage |
| Hostinger | domain/email (sudah langganan) |

---

## File konfigurasi deploy

| File | Fungsi |
|------|--------|
| `Dockerfile` | Build production Node 22 (utama) |
| `railway.toml` / `railway.json` | Builder **DOCKERFILE** — wajib |
| `.node-version` | Hint versi Node |
| `vite.config.ts` | `nitro.preset: node-server` |
| `package.json` | `"name": "seps"`, script `start` |
| `.env.railway.example` | Template Variables Railway (seps.fazagroup.id) |
| `DOMAIN_fazagroup.md` | Panduan DNS Hostinger + Railway |
