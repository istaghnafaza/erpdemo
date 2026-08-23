# Setup Staging — staging.seps.fazagroup.id

Panduan langkah demi langkah agar **production (`seps.fazagroup.id`) tidak jadi tempat uji coba**.

---

## Status otomatis (sudah dikerjakan)

| Item | Status |
|------|--------|
| Branch Git `staging` | ✅ Ada di GitHub |
| CI GitHub Actions (build + UAT) | ✅ `.github/workflows/ci.yml` |
| Skrip Neon branch staging | ✅ `npm run neon:staging:branch` |
| Skrip Railway staging env | ✅ `npm run railway:env:staging` |
| Housekeeping sesi kasir tb-arkananta | ✅ 46 sesi duplikat ditutup (tinggal 3 aktif) |
| `railway.staging.json` | ✅ Config healthcheck `/health` |

---

## Ringkasan

| Lingkungan | URL | Git branch | Database |
|------------|-----|------------|----------|
| Production | `seps.fazagroup.id` | `main` | Neon branch `main` |
| Staging | `staging.seps.fazagroup.id` | `staging` | Neon branch `staging` |
| Lokal | `localhost:8081` | feature branch | `.env` → staging Neon (disarankan) |

---

## Langkah 1 — Neon: branch staging (otomatis)

Tambahkan ke `.env` (sekali saja):

```env
NEON_API_KEY=...      # Neon Console → Account → API Keys
NEON_PROJECT_ID=...   # Neon Console → Project → Settings
```

Jalankan:

```bash
npm run neon:staging:branch
```

Hasil: file **`.env.staging.local`** (gitignored) berisi `DATABASE_URL` branch staging + `AUTH_SECRET` staging.

Lalu migrasi ke staging:

```bash
# PowerShell — pakai connection string staging sementara
$env:DATABASE_URL = (Get-Content .env.staging.local | Where-Object { $_ -match '^DATABASE_URL=' }) -replace 'DATABASE_URL=',''
$env:DATABASE_URL_DIRECT = $env:DATABASE_URL
npm run neon:migrate
npm run neon:uat:sync
```

**Manual (jika tanpa API key):** Neon Console → Branches → Create `staging` → salin connection string ke `.env.staging.local`.

---

## Langkah 2 — Git: branch `staging`

Sudah ada. Sinkronkan dengan production:

```bash
git checkout staging
git merge main
git push origin staging
```

Workflow: `feat/*` → merge **`staging`** → uji online → merge **`main`**.

---

## Tanpa Railway — Render (staging 24 jam)

Railway Hobby terkendala pembayaran. Alternatif: **Render** (Docker, region Singapore). Starter ~USD 7/bulan, 24 jam. Paket Free (jika masih ditawarkan) **tidur** saat idle — kasir jadi lambat.

### Deploy

1. Push branch `staging` ke GitHub.
2. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint** → repo ini (`render.yaml`), **atau** **Web Service** → Docker → branch `staging` → region **Singapore**.
3. Lokal:

```bash
npm run render:env:staging
```

4. Render → Environment → tempel isi **`.env.render.staging.local`**. **Jangan** isi `PORT`.
5. Deploy. URL sementara: `https://seps-staging.onrender.com` (nama bisa berbeda).
6. Samakan `AUTH_URL` dan `VITE_PUBLIC_APP_URL` dengan URL itu (atau domain custom), lalu **Manual Deploy** (karena `VITE_*` di-build ke image).
7. Custom Domain → `staging.seps.fazagroup.id` → CNAME di Hostinger ke target Render.

Neon tetap **branch staging**, bukan production.

---

## Langkah 3 — Railway: service staging (cadangan)

1. Railway → project SEPS → **+ New Service** → GitHub `erpdemo`
2. Settings → **Branch:** `staging`
3. Jalankan lokal:

```bash
npm run railway:env:staging
```

4. Copy isi **`.env.railway.staging.local`** → Railway staging → **Variables → Raw Editor → Save**
5. Klik banner ungu **Staged changes → Deploy** (bukan Redeploy lama)
6. Networking → **Custom Domain** → `staging.seps.fazagroup.id`

> **Jangan** pakai database production untuk service staging — wajib branch Neon `staging`.

---

## Langkah 4 — DNS Hostinger

1. hPanel → **fazagroup.id** → DNS
2. Tambah CNAME:

| Type | Name | Target |
|------|------|--------|
| CNAME | `staging.seps` | `<target dari Railway staging → Networking>` |

3. Tunggu SSL (5–30 menit)

---

## Langkah 5 — GitHub Secrets (CI otomatis)

Repo GitHub → **Settings → Secrets → Actions**:

| Secret | Isi |
|--------|-----|
| `NEON_DATABASE_URL` | Connection string branch **staging** |
| `NEON_DATABASE_URL_DIRECT` | Sama (direct) |

Setiap push ke `main` / `staging` → GitHub Actions menjalankan build + `neon:uat:sync`.

---

## Langkah 6 — Verifikasi

```bash
curl https://staging.seps.fazagroup.id/health
```

Smoke test: login → POS 1 transaksi → fitur yang diubah.

---

## Perintah operasional

```bash
npm run neon:predeploy                              # sebelum merge main
npm run neon:housekeeping:sessions                  # tutup sesi kasir duplikat
npm run neon:housekeeping:sessions -- --dry-run     # preview
npm run neon:diagnose:pos tb-arkananta              # tes checkout tenant
```

---

## Workflow harian

```bash
git checkout -b feat/nama-fitur
# ... coding ...
npm run neon:predeploy   # .env → Neon staging

git push origin feat/nama-fitur
git checkout staging && git merge feat/nama-fitur && git push

# Uji https://staging.seps.fazagroup.id

git checkout main && git merge staging && git push
```

---

## Google OAuth (opsional staging)

Google Cloud Console → tambah origin + redirect untuk `https://staging.seps.fazagroup.id`.

---

## Troubleshooting

| Gejala | Solusi |
|--------|--------|
| Build OK tapi app mock/neon salah | Redeploy setelah set `VITE_DATA_BACKEND=neon` |
| 502 / health gagal | Cek Railway logs, `DATABASE_URL` |
| Login redirect error | `AUTH_URL` exact match domain staging |
| POS duplicate TRX | Deploy `main` terbaru (fix nomor unik) |
| Banyak sesi open | `npm run neon:housekeeping:sessions` |

Lihat juga: [RELEASE_PROCESS.md](./RELEASE_PROCESS.md)