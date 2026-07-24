# Roadmap Migrasi: Supabase → Neon PostgreSQL + Drizzle

**Proyek:** SES — Simetri ERP Store  
**Tujuan:** Ganti Supabase (hosted PG + Auth) dengan **Neon PostgreSQL** + **Drizzle ORM** + **auth aplikasi sendiri**, tanpa mengubah komponen/hooks UI.  
**Prinsip:** Semua query tetap di `src/lib/api/*`; return shape `{ data, error }` tidak berubah.

---

## Ringkasan Eksekutif

| Aspek | Sekarang | Target |
|-------|----------|--------|
| Database | Supabase PostgreSQL | Neon PostgreSQL (region `ap-southeast-1`) |
| ORM / query | `@supabase/supabase-js` | Drizzle ORM |
| Auth | Supabase Auth (JWT) | Better Auth atau Lucia + tabel `profiles` |
| API surface | Client langsung ke Supabase | TanStack Start **server functions** (opsional fase awal: Drizzle dari client via API route) |
| Offline POS | IndexedDB → `createTransaction()` | Tetap; endpoint sync ke Neon |
| Demo mock | Zustand + localStorage | Tetap untuk `MOCK_TENANT_ID`; production pakai Neon |

**Estimasi total:** 4–6 minggu (1 dev), atau 2–3 minggu (2 dev paralel per modul).

---

## Arsitektur Target

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React 19 + TanStack Router)                        │
│  ├── Zustand stores (cache UI, demo mock)                   │
│  └── IndexedDB offline queue (POS)                          │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch / server functions
┌──────────────────────────▼──────────────────────────────────┐
│  TanStack Start Server (Nitro)                               │
│  src/server/                                                 │
│    ├── db.ts          ← Drizzle + Neon connection pool       │
│    ├── auth.ts        ← session / JWT                        │
│    └── middleware.ts  ← tenant_id dari session               │
│  src/lib/api/*.ts     ← panggil Drizzle (bukan supabase)     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Neon PostgreSQL (Singapore)                                 │
│  ├── Skema dari supabase/migrations/ (001, 002, 003)        │
│  ├── PITR backup (min 7 hari)                               │
│  └── Connection pooling (Neon built-in / PgBouncer)          │
└─────────────────────────────────────────────────────────────┘
```

**Aturan tetap berlaku (PROJECT_CONTEXT.md):**
- Setiap query wajib filter `tenant_id`
- Tidak ada `supabase.from()` di komponen/hooks
- Business logic di hooks, persistence di api layer

---

## Fase 0 — Infrastruktur & Fondasi (Minggu 1)

### 0.1 Provision Neon

1. Buat project Neon, region **AWS ap-southeast-1 (Singapore)** — latency terbaik untuk Indonesia.
2. Enable **Point-in-Time Recovery** (PITR).
3. Salin connection string:
   - `DATABASE_URL` — pooled (aplikasi)
   - `DATABASE_URL_DIRECT` — direct (migrate only)

### 0.2 Import skema existing

Jalankan file migrasi yang sudah ada (tanpa Supabase-specific RLS dulu):

```bash
# Dari folder erpdemo
psql "$DATABASE_URL_DIRECT" -f supabase/migrations/001_initial_schema.sql
psql "$DATABASE_URL_DIRECT" -f supabase/migrations/003_seed_data.sql
```

> **Catatan:** `002_rls_policies.sql` bergantung `auth.jwt()` Supabase.  
> Untuk Neon, **ganti RLS dengan enforcement di server** (middleware `tenant_id` + role check).  
> RLS bisa ditambahkan lagi nanti dengan custom JWT claim jika perlu.

### 0.3 Install dependensi

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

Opsi auth (pilih satu):

| Library | Kelebihan | Effort |
|---------|-----------|--------|
| **Better Auth** | Modern, session cookie, plugin | Sedang |
| **Lucia** | Ringan, manual control | Sedang |
| **jose + bcrypt** | Minimal dependency | Lebih banyak kode |

Rekomendasi: **Better Auth** + tabel `profiles` existing.

### 0.4 Struktur folder baru

```
src/
├── server/
│   ├── db/
│   │   ├── index.ts          # drizzle client
│   │   ├── schema/           # drizzle table definitions
│   │   │   ├── tenants.ts
│   │   │   ├── products.ts
│   │   │   └── ...
│   │   └── migrations/       # drizzle-kit output (sync dengan 001)
│   ├── auth/
│   │   └── index.ts          # Better Auth config
│   └── tenant.ts             # assertTenantAccess()
├── lib/
│   └── api/
│       ├── client.ts         # ganti: db export drizzle, bukan supabase
│       └── ...
```

### 0.5 Environment variables

Tambahkan ke `.env` (ganti `.env.example`):

```env
# Neon
DATABASE_URL=postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/ses?sslmode=require
DATABASE_URL_DIRECT=postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/ses?sslmode=require

# Auth
AUTH_SECRET=<random-32-chars-min>
AUTH_URL=http://localhost:8080

# Feature flag migrasi (penting untuk cutover bertahap)
VITE_DATA_BACKEND=neon          # neon | supabase | mock
VITE_APP_ENV=development
```

### 0.6 Drizzle bootstrap (contoh)

```typescript
// src/server/db/index.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

```typescript
// src/server/tenant.ts
export function assertTenantAccess(sessionTenantId: string, requestedTenantId: string) {
  if (sessionTenantId !== requestedTenantId) {
    throw new Error("Tenant access denied");
  }
}
```

### 0.7 Generate Drizzle schema dari SQL

```bash
npx drizzle-kit introspect --url="$DATABASE_URL_DIRECT"
# atau tulis manual mengacu src/types/database.ts (lebih type-safe)
```

**Deliverable Fase 0:**
- [ ] Neon live + skema ter-import
- [ ] Drizzle client connect sukses
- [ ] `drizzle-kit studio` bisa browse tabel
- [ ] Feature flag `VITE_DATA_BACKEND` terpasang di `client.ts`

**Gate (wajib lulus sebelum Fase 1):**
```bash
npm run build
# smoke test: SELECT 1 FROM tenants LIMIT 1 via drizzle
```

---

## Fase 1 — Auth, Tenants & Branches (Minggu 1–2)

**Prioritas:** Tanpa auth, modul lain tidak aman.

### File yang dimigrasi

| File API | Fungsi | Tabel |
|----------|--------|-------|
| `auth.ts` | `signIn`, `signOut`, `getCurrentUser`, `signInWithPin`, `updateProfile`, `subscribeToAuthChanges` | `profiles`, `user_branches` |
| `tenants.ts` | CRUD tenant, `getTenantBySlug`, `setOnboardingComplete` | `tenants` |
| `branches.ts` | CRUD cabang, assign user | `branches`, `user_branches` |
| `users.ts` | `listTenantUsers`, `createTenantUser`, dll. | `profiles`, `user_branches` |

### Langkah teknis

1. **Ganti Supabase Auth:**
   - `signIn(email, password)` → Better Auth `signInEmail` + load profile dari `profiles`
   - `getCurrentUser()` → baca session cookie server-side
   - `subscribeToAuthChanges` → polling session atau SSE (Supabase realtime tidak dipakai)

2. **PIN login POS (`signInWithPin`):**
   ```typescript
   // Drizzle equivalent
   const profile = await db.query.profiles.findFirst({
     where: and(
       eq(profiles.tenantId, tenantId),
       eq(profiles.email, email),
       eq(profiles.pin, pin),
       eq(profiles.isActive, true),
     ),
   });
   ```
   > **Keamanan:** rencanakan hash PIN (bcrypt) — saat ini plain text di seed demo.

3. **Password:** simpan hash di kolom baru `password_hash` di `profiles`, atau tabel `auth_credentials` terpisah.

4. **Update `auth.store.ts`:**
   - Tetap pakai mock untuk `MOCK_TENANT_ID`
   - Production: panggil `api.auth.signIn` yang sudah pakai Neon

### Mapping Supabase → Drizzle (contoh)

```typescript
// SEBELUM (Supabase)
const { data, error } = await db.from("branches")
  .select("*")
  .eq("tenant_id", tenantId)
  .order("name");

// SESUDAH (Drizzle)
const data = await db.query.branches.findMany({
  where: eq(branches.tenantId, tenantId),
  orderBy: asc(branches.name),
});
return ok(data);
```

### Hooks / routes terdampak

- `src/routes/login.tsx`
- `src/stores/auth.store.ts`
- `src/routes/$tenantSlug/__layout.tsx` (auth guard)

### Deliverable Fase 1

- [ ] Login email/password production via Neon
- [ ] PIN kasir via Neon
- [ ] Session persist (cookie httpOnly)
- [ ] `getBranches()` return data real
- [ ] Mock tenant (`toko-simetri`) tetap jalan tanpa Neon

**Test plan:**
1. Login owner → redirect dashboard
2. Login kasir PIN → buka POS
3. User cabang A tidak bisa query cabang tenant lain (negative test)

---

## Fase 2 — Products, Customers & Inventory Dasar (Minggu 2)

**Prioritas:** Katalog & stok adalah fondasi POS dan laporan.

### File yang dimigrasi

| File API | Fungsi utama | Tabel |
|----------|--------------|-------|
| `products.ts` | kategori, master produk, `branch_products`, harga | `product_categories`, `products`, `branch_products` |
| `customers.ts` | CRUD pelanggan, kredit | `customers` |
| `inventory.ts` (partial) | `getStockMovements`, `recordStockMovement`, `adjustStock` | `stock_movements`, `branch_products` |

### Pola query kompleks

**Join produk + kategori** (sekarang: `select("*, category:category_id(...)")`):

```typescript
const rows = await db
  .select({
    product: products,
    category: { id: productCategories.id, name: productCategories.name, icon: productCategories.icon },
  })
  .from(products)
  .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
  .where(eq(products.tenantId, tenantId));
```

**`upsertBranchProduct`:** pakai `db.insert().onConflictDoUpdate()`.

### Hooks terdampak

- `useInventoryProducts.ts`
- `usePos.ts` (prefetch katalog via `getBranchProducts`)
- `useSalesOrders.ts`

### Onboarding → Neon

Saat `handleFinish` onboarding selesai, panggil:
- `api.branches.createBranch`
- `api.products.createProduct` / bulk insert
- Bukan hanya `inventory.store` localStorage

File terkait:
- `src/lib/apply-onboarding-inventory.ts` — tambah path `persistToNeon()`
- `src/routes/onboarding/index.tsx` — `handleFinish`

### Deliverable Fase 2

- [x] Master Barang CRUD live di Neon
- [x] Stok per cabang (`branch_products`) live
- [x] Pelanggan CRUD live
- [x] Onboarding menulis produk ke Neon (bukan hanya localStorage)
- [x] POS baca katalog dari Neon saat `VITE_DATA_BACKEND=neon`

**KPI fase ini:**
- `getBranchProducts` p95 < 100 ms (dengan index `tenant_id + branch_id`)
- Zero cross-tenant leak di test otomatis

---

## Fase 3 — POS & Transaksi (Minggu 3)

**Prioritas:** Core revenue path — paling kritis untuk durability & ACID.

### File yang dimigrasi

| File API | Fungsi | Tabel |
|----------|--------|-------|
| `transactions.ts` | sesi kasir, cart, `createTransaction`, void | `cashier_sessions`, `pos_carts`, `sales_transactions`, `sales_items` |
| `inventory.ts` (partial) | deduct stock saat jual | `branch_products`, `stock_movements` |
| `sales-transactions.ts` | list transaksi | `sales_transactions` |

### Transaksi ACID (wajib)

`createTransaction` harus satu **database transaction**:

```typescript
await db.transaction(async (tx) => {
  // 1. Insert sales_transactions
  // 2. Insert sales_items (batch)
  // 3. Update branch_products stock (per item)
  // 4. Insert stock_movements
  // 5. Jika kredit: insert/update accounts_receivable
  // 6. Jika cash: insert cash_transactions
  // 7. Update cashier_session totals
});
```

> Ini menggantikan multiple `supabase.from().insert()` terpisah yang bisa partial-fail.

### Offline sync

File: `src/lib/offline/sync.ts`

Perubahan:
1. Tambah **idempotency key** di `sales_transactions` (kolom `client_tx_id` UNIQUE per tenant)
2. Sync queue kirim `client_tx_id` → jika duplikat, return success (bukan error)
3. Hapus bypass `isMockOfflineItem` untuk tenant production

```sql
ALTER TABLE sales_transactions
  ADD COLUMN client_tx_id TEXT,
  ADD CONSTRAINT uq_sales_client_tx UNIQUE (tenant_id, client_tx_id);
```

### Hooks / stores terdampak

- `usePos.ts`
- `pos.store.ts`
- `offline.store.ts`
- `src/lib/offline/sync.ts`

### Deliverable Fase 3

- [x] Buka/tutup shift kasir → Neon
- [x] Transaksi POS tersimpan atomik
- [x] Void transaction konsisten (stok dikembalikan)
- [x] Offline queue sync ke Neon dengan idempotency
- [ ] Held carts persist (opsional fase 3b — metadata cart saja, line items tetap client-side)

**Test plan kritis:**
1. Transaksi 10 item → stok berkurang tepat
2. Simulasi putus internet → queue → sync → tidak double charge
3. Void → stok kembali, status `voided`

---

## Fase 4 — Finance, Piutang & Hutang (Minggu 4)

### File yang dimigrasi

| File API | Tabel |
|----------|-------|
| `finance.ts` | `cash_accounts`, `cash_transactions` |
| `receivables.ts` | `accounts_receivable`, `ar_payments` |
| `payables.ts` | `accounts_payable`, `ap_payments` |

### Business rules yang harus dijaga

| Operasi | Aturan |
|---------|--------|
| `recordArPayment` | Update AR + insert `ar_payments` + insert `cash_transactions` (satu TX) |
| `recordApPayment` | Update AP + insert `ap_payments` + insert `cash_transactions` |
| `recordCashTransaction` | Update saldo `cash_accounts.current_balance` |
| POS kredit | Auto-create AR saat transaksi kredit |

### Hooks terdampak

- `useFinance.ts`
- `useCashBook.ts`
- `useDashboard.ts` (via `finance.store` — migrasi store dari localStorage ke API)
- `finance-calculations.ts` — tetap pure function, input dari API

### Deliverable Fase 4

- [x] Buku kas live Neon
- [x] Pembayaran piutang/hutang update kas atomik
- [x] Dashboard keuangan baca dari API (bukan seed localStorage)
- [x] POS kredit auto-create AR (via transaksi atomik Fase 3+4)

---

## Fase 5 — Purchasing, Sales Orders & Reports (Minggu 5)

### Deliverable Fase 5

- [x] PO → GRN → stok masuk atomik
- [x] Sales order + fulfillment
- [x] Stock opname & transfer antar cabang
- [x] Semua halaman reports return data Neon

---

## Fase 6 — Cutover, Monitoring & Decommission Supabase (Minggu 6)

### 6.1 Checklist cutover

| # | Task |
|---|------|
| 1 | Export data Supabase (jika ada production pilot) → import ke Neon |
| 2 | Set `VITE_DATA_BACKEND=neon` di staging |
| 3 | UAT lengkap: onboarding → POS → finance → reports |
| 4 | Load test 50 transaksi POS concurrent |
| 5 | Verifikasi backup restore (PITR drill) |
| 6 | Set production env |
| 7 | Hapus `VITE_SUPABASE_*` dari production |
| 8 | Uninstall `@supabase/supabase-js` |

### 6.2 Monitoring KPI

| Metrik | Target | Tool |
|--------|--------|------|
| API latency p95 | < 200 ms | Neon dashboard / Axiom |
| DB connection errors | < 0.1% | Sentry |
| Offline sync success | ≥ 99.5% | custom metric di `sync.ts` |
| Transaction rollback rate | monitored | server logs |
| RPO | ≤ 5 menit | Neon PITR |
| RTO | ≤ 1 jam | runbook restore |

### 6.3 Rollback plan

Jika cutover gagal:
1. Set `VITE_DATA_BACKEND=supabase` (feature flag)
2. Redirect traffic ke Supabase project lama
3. Transaksi selama cutover di Neon di-reconcile manual atau di-replay

Simpan feature flag minimal **2 minggu** pasca cutover.

### Deliverable Fase 6

- [x] Notifikasi app memakai API polling (Neon) — tanpa koneksi Supabase langsung
- [x] Health check: `npm run neon:health` + `neonHealthCheck` server fn
- [x] UAT smoke test: `npm run neon:uat`
- [x] CSRF middleware untuk server functions
- [x] Offline sync metrics (`sync-metrics.ts`, target ≥ 99.5%)
- [x] Histori penjualan dari Neon (`listSalesTransactions` + halaman sales)
- [x] Register/login + Google OAuth (self-service tenant)
- [x] DB driver WebSocket Pool (transaksi Neon)
- [x] Dokumen cutover: `neon/CUTOVER.md`
- [x] `.env.example` default `VITE_DATA_BACKEND=neon`, Supabase dikomentari
- [ ] UAT production manual (onboarding → POS → finance → reports)
- [ ] Hapus `VITE_SUPABASE_*` di env deploy production
- [ ] Uninstall `@supabase/supabase-js` setelah jendela rollback 2 minggu

---

## Matriks File API Lengkap

| File | Fase | Jumlah fungsi export | Kompleksitas |
|------|------|---------------------|--------------|
| `client.ts` | 0 | 4 util | Rendah |
| `auth.ts` | 1 | 6 | Tinggi (auth baru) |
| `tenants.ts` | 1 | 7 | Rendah |
| `branches.ts` | 1 | 10 | Rendah |
| `users.ts` | 1 | 4 | Rendah |
| `products.ts` | 2 | 18 | Sedang |
| `customers.ts` | 2 | 6 | Rendah |
| `inventory.ts` | 2, 5 | 10 | Tinggi (TX) |
| `transactions.ts` | 3 | 13 | **Kritis** (ACID) |
| `finance.ts` | 4 | 7 | Tinggi (TX) |
| `receivables.ts` | 4 | 7 | Tinggi (TX) |
| `payables.ts` | 4 | 6 | Tinggi (TX) |
| `purchasing.ts` | 5 | 9 | Tinggi (TX) |
| `sales-orders.ts` | 5 | 8 | Sedang |
| `reports.ts` | 5 | 6 | Sedang (agregasi) |
| `sales-transactions.ts` | 3, 6 | 1 | Rendah → **Neon wired** |

**Total:** ~16 file, ~120 fungsi export.

---

## Strategi Feature Flag (cutover aman)

```typescript
// src/lib/api/client.ts (konsep)
const backend = import.meta.env.VITE_DATA_BACKEND ?? "mock";

export async function getDataBackend() {
  if (backend === "neon") return (await import("@/server/db")).db;
  if (backend === "supabase") return (await import("@/lib/supabase")).supabase;
  return null; // mock path di stores
}
```

Per modul, ganti implementasi:

```typescript
// src/lib/api/products.ts
export async function getProducts(tenantId: string, options?) {
  if (useMock(tenantId)) return mockProducts.getAll(tenantId);
  return getProductsNeon(tenantId, options);  // Drizzle
}
```

---

## Yang TIDAK perlu diubah

| Area | Alasan |
|------|--------|
| `src/routes/**/*.tsx` (UI) | API contract sama |
| `src/hooks/*.ts` | Tetap import `@/lib/api` |
| `src/types/database.ts` | Tetap jadi source of truth tipe |
| `src/lib/finance-calculations.ts` | Pure functions |
| Komponen shadcn/ui | Tidak terkait storage |

---

## Urutan eksekusi (quick reference)

```
Fase 0  Infra Neon + Drizzle + env
   ↓
Fase 1  auth → tenants → branches → users
   ↓
Fase 2  products → customers → stock movements
   ↓
Fase 3  POS sessions → carts → createTransaction → offline sync
   ↓
Fase 4  cash book → AR → AP
   ↓
Fase 5  PO/GRN → sales orders → reports → opname/transfer
   ↓
Fase 6  UAT → cutover → hapus Supabase
```

---

## Task pertama jika mulai hari ini

1. Buat akun Neon + import `001_initial_schema.sql`
2. `npm install drizzle-orm @neondatabase/serverless drizzle-kit`
3. Buat `src/server/db/index.ts` + schema `tenants`, `profiles`, `branches`
4. Migrasi `api/tenants.ts` + `api/branches.ts` (paling mudah, validasi pipeline)
5. Setup Better Auth + migrasi `api/auth.ts`
6. Feature flag `VITE_DATA_BACKEND` di `client.ts`

---

## Referensi internal

| Dokumen / path | Isi |
|----------------|-----|
| `supabase/migrations/001_initial_schema.sql` | Skema PG lengkap (28 tabel) |
| `supabase/migrations/003_seed_data.sql` | Data demo |
| `src/lib/api/index.ts` | Barrel export API |
| `src/types/database.ts` | TypeScript types |
| `PROJECT_CONTEXT.md` | Aturan arsitektur |
| `src/lib/offline/sync.ts` | Offline queue POS |
| `src/stores/*.ts` | Mock localStorage (tetap untuk demo) |

---

*Dokumen ini dibuat untuk migrasi bertahap. **Fase 0–6 (kode) selesai** — UAT production & hapus Supabase env tinggal manual (lihat `neon/CUTOVER.md`).*
