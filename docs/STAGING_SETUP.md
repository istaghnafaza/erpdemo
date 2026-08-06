# Setup Staging — staging.seps.fazagroup.id

Panduan langkah demi langkah agar **production (`seps.fazagroup.id`) tidak jadi tempat uji coba**.

---

## Ringkasan

| Lingkungan | URL | Git branch | Database |
|------------|-----|------------|----------|
| Production | `seps.fazagroup.id` | `main` | Neon branch `main` |
| Staging | `staging.seps.fazagroup.id` | `staging` | Neon branch `staging` |
| Lokal | `localhost:8081` | feature branch | `.env` → staging Neon (disarankan) |

---

## Langkah 1 — Neon: branch staging

1. Buka [Neon Console](https://console.neon.tech) → project SEPS
2. **Branches** → **Create branch**
   - Name: `staging`
   - Parent: `main` (copy schema + data saat ini)
3. Salin connection string branch **staging**:
   - `DATABASE_URL`
   - `DATABASE_URL_DIRECT` (direct, tanpa pooler — untuk migrasi)

Simpan di password manager — jangan commit ke Git.

---

## Langkah 2 — Git: branch `staging`

Di komputer dev:

```bash
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging
```

Ke depan: merge `feat/xyz` → `staging` dulu, uji online, baru merge `staging` → `main`.

---

## Langkah 3 — Railway: service staging

1. Railway → project yang sama → **New Service** → **GitHub Repo** → repo `erpdemo`
2. Settings:
   - **Root Directory:** `/`
   - **Branch:** `staging` (bukan `main`)
   - Builder: Dockerfile (sama dengan production)
3. **Variables** → Raw Editor — salin dari `.env.staging.example`, isi secret staging Neon:

```env
DATABASE_URL=postgresql://...@...-staging...neon.tech/neondb?sslmode=require
DATABASE_URL_DIRECT=postgresql://...@...-staging...neon.tech/neondb?sslmode=require
AUTH_SECRET=<generate baru, min 32 char, beda dari production>
AUTH_URL=https://staging.seps.fazagroup.id
PORT=8080
VITE_DATA_BACKEND=neon
VITE_APP_NAME=SEPS Staging
VITE_APP_ENV=staging
VITE_PUBLIC_APP_URL=https://staging.seps.fazagroup.id
NODE_ENV=production
```

4. **Deploy** — tunggu build hijau
5. Salin URL Railway sementara: `https://erpdemo-staging.up.railway.app`

> **Penting:** `VITE_*` harus ada **sebelum** build. Set variables lalu trigger deploy baru.

---

## Langkah 4 — DNS Hostinger

1. hPanel → **fazagroup.id** → DNS
2. Tambah record:

| Type | Name | Target |
|------|------|--------|
| CNAME | `staging.seps` | `<target dari Railway staging → Networking → Custom Domain>` |

3. Railway staging service → **Networking** → **Custom Domain** → `staging.seps.fazagroup.id`
4. Tunggu SSL (5–30 menit)

---

## Langkah 5 — Verifikasi staging

```bash
curl https://staging.seps.fazagroup.id/health
```

Harus `"ok": true` dan `"databaseConfigured": true`.

Smoke test manual:

1. Login (bisa pakai tenant yang di-copy dari branch Neon)
2. POS — buka shift → 1 transaksi tunai
3. Fitur yang baru diubah

---

## Langkah 6 — Workflow harian

```bash
# Kerja fitur
git checkout -b feat/nama-fitur
# ... coding ...
npm run neon:predeploy   # dengan .env menunjuk ke Neon staging

git push origin feat/nama-fitur
# Merge ke staging (GitHub PR atau lokal)
git checkout staging && git merge feat/nama-fitur && git push

# Uji https://staging.seps.fazagroup.id

# Production (hanya setelah staging OK)
git checkout main && git merge staging && git push
# Railway production auto-deploy
```

---

## Migrasi di staging vs production

```bash
# .env sementara → DATABASE_URL branch staging
npm run neon:migrate
npm run neon:uat:sync

# Setelah OK di staging, ulangi di production .env
npm run neon:migrate
```

---

## Google OAuth (opsional staging)

Di Google Cloud Console, tambahkan:

- Origin: `https://staging.seps.fazagroup.id`
- Redirect: `https://staging.seps.fazagroup.id/auth/google/callback`

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID` di Railway staging.

---

## Troubleshooting

| Gejala | Solusi |
|--------|--------|
| Build OK tapi app mock/neon salah | Redeploy setelah set `VITE_DATA_BACKEND=neon` |
| 502 / health gagal | Cek Railway logs, `DATABASE_URL` |
| Login redirect error | `AUTH_URL` harus exact match domain staging |
| POS gagal duplicate TRX | Sudah diperbaiki — deploy `main` terbaru |

Lihat juga: [RELEASE_PROCESS.md](./RELEASE_PROCESS.md)
