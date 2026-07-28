# Neon Setup — Fase 0–5



## 1. Buat project Neon (region Singapore)



1. [console.neon.tech](https://console.neon.tech) → New Project → **ap-southeast-1**

2. Salin connection string ke `.env`:



```env

DATABASE_URL=postgresql://...@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

DATABASE_URL_DIRECT=postgresql://...@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

AUTH_SECRET=ganti-dengan-string-random-min-32-karakter

AUTH_URL=http://localhost:8080

VITE_DATA_BACKEND=neon

```



## 2. Import skema + seed



Di Neon SQL Editor (atau `psql`), jalankan **berurutan**:



```sql

-- neon/phase1_schema.sql

-- neon/phase1_seed.sql

-- neon/phase2_schema.sql

-- neon/phase2_seed.sql

-- neon/phase3_schema.sql

-- neon/phase4_schema.sql

-- neon/phase4_seed.sql

-- neon/phase5_schema.sql

```

Atau otomatis (butuh `DATABASE_URL` di `.env`):

```bash
npm run neon:setup
```



## 3. Jalankan aplikasi



```bash

npm run dev

```



Login production:

- **Email:** `budi@simetri.id`

- **Password:** `DemoSES2025!`



Quick login mock tetap aktif jika `VITE_DATA_BACKEND=mock` (default).



## Demo user & PIN



| Email | Role | PIN |

|-------|------|-----|

| budi@simetri.id | owner | 000000 |

| siti@simetri.id | manager | 111111 |

| andi@simetri.id | cashier | 222222 |

## Tenant uji coba — TB Lumayan

Jalankan seed (butuh `.env` Neon):

```bash
npm run neon:seed:lumayan
```

| Email | Role | Password / PIN |
|-------|------|----------------|
| owner@seps.id | owner | 111111 |
| manager@seps.id | manager | 111111 |
| kasir@seps.id | cashier | 111111 |
| gudang@seps.id | warehouse | 111111 |

URL: `https://seps.fazagroup.id/login` → redirect ke `/tb-lumayan/dashboard`

Isi data: 2 cabang, 15 produk + stok, 8 pelanggan, 5 supplier. **Tanpa** histori penjualan / keuangan / pengiriman.

## Arsitektur



```

Browser → createServerFn (src/lib/api/neon/*.ts)

       → Drizzle (src/server/db/)

       → Neon PostgreSQL

```



## Modul yang sudah di Neon



| Fase | Modul |

|------|-------|

| 1 | Auth, Tenants, Branches, Users |

| 2 | Products, Categories, Branch Products, Customers, Stock Movements (dasar), Onboarding inventory |

| 3 | POS Sessions, Sales Transactions (ACID), Void, Offline sync (`client_tx_id`) |

| 4 | Cash Accounts, Cash Transactions, AR/AP, pembayaran atomik |
| 5 | PO/GRN, Sales Orders, stock transfer/opname, reports |
| 6 | Cutover docs, health check, notifikasi via API (decommission Supabase di production) |

Modul Supabase-only: Realtime notifikasi (hanya jika `VITE_DATA_BACKEND=supabase` rollback).



## Catatan onboarding (Neon)



Saat `VITE_DATA_BACKEND=neon`, wizard onboarding:

- Membuat cabang nyata via API

- Menyimpan katalog produk ke PostgreSQL

- Menandai `onboarding_complete` dan `legacy_mode_active` di tenant



POS & Master Barang membaca data dari Neon (bukan mock catalog) meskipun tenant ID sama dengan demo mock.

## Catatan POS (Neon)

- Buka/tutup shift kasir persist ke `cashier_sessions`
- Checkout menjalankan transaksi atomik: insert transaksi + kurangi stok + update sesi + piutang pelanggan (kredit)
- Offline queue mengirim `client_tx_id` = `localId` untuk idempotency (tidak double-charge saat sync)

## Fase 6 — Cutover

1. Smoke test: `npm run neon:health`
2. UAT otomatis: `npm run neon:uat`
3. Ikuti checklist UAT manual: [`neon/CUTOVER.md`](./CUTOVER.md)
4. Production: `VITE_DATA_BACKEND=neon`, hapus `VITE_SUPABASE_*`
5. Rollback ≤ 2 minggu: set `VITE_DATA_BACKEND=supabase` + restore env Supabase

### Post-cutover (kode Fase 6+)

- Register/login email + Google OAuth (`/register`, `/login`)
- Histori penjualan dari Neon (bukan mock store)
- Offline sync metrics di `localStorage` (`ses-sync-metrics`)
- CSRF protection pada server functions

