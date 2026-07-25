# SEPS — Domain `seps.fazagroup.id`

Panduan setup **Railway + Hostinger DNS** untuk staging/production SEPS.

**URL final:** `https://seps.fazagroup.id`

---

## Status Anda (per 25 Jul 2026)

| Tahap | Status | Keterangan |
|-------|--------|------------|
| Deploy Railway (Docker) | ✅ Selesai | Commit `77b0372` — service ACTIVE |
| Neon database | ✅ Selesai | `npm run neon:health` → ok, 2 tenant |
| Custom domain Railway | ✅ Selesai | `seps.fazagroup.id` |
| DNS Hostinger (CNAME + TXT) | ✅ Selesai | Agent Hostinger konfirmasi |
| **Railway Variables** | ⏳ **Langkah aktif** | Sudah paste — tambah `PORT=8080`, redeploy commit terbaru |
| Redeploy setelah Variables | ⏳ Menunggu | Wajib setelah save Variables |
| Uji login online | ⏳ Menunggu | Setelah redeploy |
| Google OAuth production | ⏸ Opsional | Nanti |

**Gejala saat ini:** browser menampilkan *"This page didn't load"* — DNS sudah benar, tapi **env vars Railway belum lengkap**.

---

## Checklist (centang saat selesai)

- [x] **1.** Railway: tambah custom domain `seps.fazagroup.id`
- [x] **2.** Hostinger: CNAME `seps` → target Railway
- [ ] **3.** Railway Variables: `AUTH_URL` + Neon + `AUTH_SECRET`
- [ ] **4.** Railway: Redeploy
- [ ] **5.** Uji `https://seps.fazagroup.id/login`
- [ ] **6.** (Opsional) Google OAuth origins

---

## 1. Railway — Custom Domain

1. Buka [railway.app](https://railway.app) → project → service **erpdemo**
2. **Settings** → **Networking**
3. Di **Custom Domain**, ketik: `seps.fazagroup.id` → **Add**
4. Railway menampilkan **CNAME target**, contoh:
  ```
   xxxxx.up.railway.app
  ```
   **Salin target ini** — dipakai di Hostinger langkah 2.
5. Tunggu status domain di Railway menjadi **Active** (setelah DNS benar, 5–30 menit)

> Jika belum ada **Generate Domain** Railway (`*.up.railway.app`), buat dulu — dipakai sementara sebelum custom domain aktif.

---



## 2. Hostinger — DNS CNAME

1. Login **hPanel** Hostinger
2. **Domains** → **fazagroup.id** → **DNS Zone** / **Manage DNS**
3. **Add Record**:


| Type      | Name   | Target / Points to            | TTL |
| --------- | ------ | ----------------------------- | --- |
| **CNAME** | `seps` | *(paste target dari Railway)* | 300 |


1. **Save**
2. Jangan buat A record untuk `seps` — pakai CNAME saja.

**Verifikasi (PowerShell, setelah 5–15 menit):**

```powershell
nslookup seps.fazagroup.id
```

Harus resolve ke hostname Railway (bukan error NXDOMAIN).

---



## 3. Railway — Environment Variables

### Cara cepat (dari PC Anda)

Di folder project (`.env` lokal sudah terisi Neon):

```powershell
cd "e:\VIBE CODING PROJECT\SEPS\erpdemo"
npm run railway:env
```

Buka file **`.env.railway.local`** → salin semua → paste ke Railway **Variables → Raw Editor** → **Save**.

> File ini **gitignored** — tidak akan ter-commit.

### Atau isi manual

**Variables** → **Raw Editor** → paste (ganti yang `<...>`):

```env
# --- Neon (salin dari .env lokal Anda) ---
DATABASE_URL=<postgresql://...@...neon.tech/...?sslmode=require>
DATABASE_URL_DIRECT=<sama atau direct connection dari Neon Console>

# --- Auth ---
AUTH_SECRET=<random min 32 karakter — jangan kosong>
AUTH_URL=https://seps.fazagroup.id

# --- App ---
VITE_DATA_BACKEND=neon
VITE_APP_NAME=SEPS
VITE_APP_ENV=staging
NODE_ENV=production

# --- Opsional: Google OAuth (setelah Console di-update) ---
# VITE_GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# VITE_PUBLIC_APP_URL=https://seps.fazagroup.id
```

**Penting:**

- `AUTH_URL` = `https://seps.fazagroup.id` (**tanpa** `/` di akhir)
- Jangan commit file `.env` ke GitHub

**Generate AUTH_SECRET baru (PowerShell):**

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```



### Neon — cek database sudah siap

Di folder project lokal (`.env` sudah terisi):

```bash
npm run neon:health
```

Harus `"ok": true` dan `tenantCount` ≥ 1.

Login demo (jika seed sudah di-import):

- Email: `budi@simetri.id`
- Password: `DemoSES2025!`

---



## 4. Redeploy

Setelah save Variables:

- **Deployments** → deployment **ACTIVE** → **⋯** → **Redeploy**

Atau push ke `main` (auto-deploy).

---



## 5. Uji online


| URL                                      | Harus                  |
| ---------------------------------------- | ---------------------- |
| `https://seps.fazagroup.id/pwa-icon.svg` | File SVG (healthcheck) |
| `https://seps.fazagroup.id/health`       | Halaman "SEPS OK"      |
| `https://seps.fazagroup.id/login`        | Form login SEPS        |


---



## 6. Google OAuth (opsional)

[Google Cloud Console](https://console.cloud.google.com/) → OAuth 2.0 Client:

**Authorized JavaScript origins:**

```
https://seps.fazagroup.id
```

**Authorized redirect URIs:**

```
https://seps.fazagroup.id/auth/google/callback
```

Railway Variables (uncomment + isi):

```env
VITE_GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
VITE_PUBLIC_APP_URL=https://seps.fazagroup.id
```

Redeploy lagi.

---



## Struktur domain Faza Group


| Host                   | Fungsi                          |
| ---------------------- | ------------------------------- |
| `fazagroup.id` / `www` | Website perusahaan (Hostinger)  |
| `seps.fazagroup.id`    | **SEPS — ERP (Railway + Neon)** |
| Email `@fazagroup.id`  | Email bisnis (Hostinger)        |


---



## Troubleshooting


| Gejala                   | Solusi                                                        |
| ------------------------ | ------------------------------------------------------------- |
| DNS tidak resolve        | Tunggu propagasi; cek CNAME `seps` di Hostinger               |
| Railway domain "Pending" | CNAME belum benar atau belum propagate                        |
| SSL error                | Tunggu Railway issue cert (beberapa menit setelah DNS active) |
| Login 500 / DATABASE_URL | Cek Deploy Logs: `database=ok`. Jika `MISSING`, paste ulang `.env.railway.local` → Redeploy |
| SSR `jsxDEV is not a function` | Dockerfile build harus `NODE_ENV=production npm run build` |
| Redirect loop login      | `AUTH_URL` harus exact `https://seps.fazagroup.id`            |
| Google login gagal       | Origins + redirect URI + `VITE_PUBLIC_APP_URL`                |


---



## Template tanpa secret

Lihat juga: `.env.railway.example`