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

### Build & start (Dockerfile — wajib)

Railway **harus** pakai Dockerfile (bukan Nixpacks). Cek di Service → Settings → Builder = **Dockerfile**.

- **Build:** `npm ci` → patch nf3 → `vite build` (Node 22)
- **Start:** `node .output/server/index.mjs`

Jika log masih menampilkan `[stage-0 ...] --mount=type=cache ... node_modules/.cache`, berarti masih Nixpacks — ubah builder ke Dockerfile lalu redeploy commit terbaru.

### Generate domain

Railway → Service → **Settings** → **Networking** → **Generate Domain**

Copy URL → update `AUTH_URL` → redeploy.

---

## 3. Uji staging

1. Buka `https://<railway-url>/login`
2. Register akun baru **atau** login seed (jika sudah di-import Neon):
   - `budi@simetri.id` / `DemoSES2025!`
3. Wizard onboarding → POS → Dashboard

Health check Railway: path `/login` (lihat `railway.toml`).

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

---

## 5. Hostinger — domain custom (opsional)

1. Railway → custom domain → dapat CNAME target
2. Hostinger hPanel → DNS → **CNAME** `app` → target Railway
3. Update `AUTH_URL` ke `https://app.domainanda.com`
4. Update Google OAuth origins + redirect URI

Hostinger **Premium/Business** tetap berguna untuk email bisnis & landing page — app utama di Railway.

---

## 6. Troubleshooting

| Gejala | Solusi |
|--------|--------|
| Build gagal `EBUSY node_modules/.cache` | Jangan ulang `npm ci` di build command — Railway sudah install otomatis |
| Build gagal `nodeFileTrace` / `@vercel/nft` | Pakai **Dockerfile** (sudah di repo) — bug Nixpacks + Nitro trace di Linux |
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
| `.env.example` | Template env |
