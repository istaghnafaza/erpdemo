# PROGRESS LOG — SES Simetri ERP Store

> **Stack:** TanStack Start + TanStack Router (file-based) + React 19 + TypeScript + Tailwind v4 + shadcn/ui  
> **Backend:** Supabase (PostgreSQL + Auth) → target migrasi ke Laravel  
> **Terakhir diupdate:** 2026-07-03  
> **Fase MVP:** Fase 0–16 ✅ selesai  
> **Fase Berikutnya:** Post-MVP — penyempurnaan fitur per modul + validasi form (log di bawah)

---

> [!IMPORTANT]
> **Lokasi proyek pindah folder pada 2026-07-01.** Path lama
> `E:\#VIBE CODING PROJECT\SEPS\erpdemo` mengandung karakter `#` yang
> menyebabkan Vite 8/Rolldown gagal resolve virtual module SSR (`500`
> di dev server, `UNRESOLVED_IMPORT` di build produksi). Seluruh isi
> proyek (termasuk `.git` dan `.env`) sudah disalin ke path baru:
>
> **`E:\VIBE CODING PROJECT\SEPS\erpdemo`** (tanpa tanda `#`)
>
> Folder lama sengaja belum dihapus (masih berisi kode versi sebelum
> Fase 5 — jangan diedit lagi). Pastikan window Cursor/IDE dibuka pada
> path **baru** sebelum melanjutkan kerja, agar tidak terjadi
> percabangan kode yang tidak sinkron.

---

## Ringkasan Status

| Fase | Nama | Status | Selesai |
|------|------|--------|---------|
| 0 | Environment Setup | ✅ SELESAI | 2026-07-01 |
| 1 | Database Schema & Migrations | ✅ SELESAI | 2026-07-01 |
| 2 | Data Abstraction Layer (API) | ✅ SELESAI | 2026-07-01 |
| 3 | State Management (Zustand) | ✅ SELESAI | 2026-07-01 |
| 4 | Multi-Tenant Routing | ✅ SELESAI | 2026-07-01 |
| 4.5 | Unifikasi Auth Layer ke Zustand | ✅ SELESAI | 2026-07-01 |
| 5 | App Shell & Global UI | ✅ SELESAI | 2026-07-01 |
| 6 | Dashboard Module | ✅ SELESAI | 2026-07-01 |
| 7 | POS Kasir | ✅ SELESAI | 2026-07-01 |
| 8 | Inventory & Stock | ✅ SELESAI | 2026-07-01 |
| 9 | Sales Orders | ✅ SELESAI | 2026-07-01 |
| 10 | Purchasing & Goods Receipt | ✅ SELESAI | 2026-07-01 |
| 11 | Finance & Cash Book | ✅ SELESAI | 2026-07-01 |
| 12 | Receivables & Payables | ✅ SELESAI | 2026-07-01 |
| 13 | Reports & Analytics | ✅ SELESAI | 2026-07-01 |
| 14 | Onboarding Wizard | ✅ SELESAI | 2026-07-01 |
| 15 | PWA & Offline Capability | ✅ SELESAI | 2026-07-01 |
| 16 | Polish, RBAC & Testing | ✅ SELESAI | 2026-07-01 |
| **P** | **Post-MVP — Penyempurnaan & Validasi** | 🔄 BERLANGSUNG | 2026-07-01 |

> Catatan penomoran: urutan fase 6+ disesuaikan mengikuti
> `CURSOR_INSTRUCTIONS.md` — Dashboard dikerjakan sebelum Authentication
> penuh karena login demo (`loginAsMock`) sudah mencukupi untuk
> pengembangan UI/modul saat ini.

---

## Fase 0 — Environment Setup ✅ SELESAI

**Tujuan:** Menyiapkan environment development yang konsisten.

### Yang dikerjakan:
- Upgrade Node.js ke v24.18.0 LTS
- Install dependencies: `framer-motion`, `idb-keyval` (sudah ada: `zustand`, `@supabase/supabase-js`, `date-fns`, `lucide-react`)
- Konfigurasi Supabase client dengan type safety

### File yang Dibuat/Diubah:
```
.env.example                      ← template environment variables
.env                              ← credentials Supabase (tidak di-commit)
.gitignore                        ← +.env entry
src/lib/supabase.ts               ← Supabase client dengan permissive Database type
```

---

## Fase 1 — Database Schema & Migrations ✅ SELESAI

**Tujuan:** Schema PostgreSQL multi-tenant yang production-ready di Supabase.

### Yang dikerjakan:
- 32 tabel dengan `tenant_id UUID NOT NULL` di semua tabel
- 12 ENUM types untuk status, role, payment method, dll
- Row Level Security (RLS) — semua tabel terlindungi
- Granular RLS policies per operasi (SELECT/INSERT/UPDATE/DELETE) per role
- RBAC helper functions: `get_user_role()`, `is_owner_or_manager()`, dll
- Indexes pada `tenant_id`, `branch_id`, `created_at`
- Auto `updated_at` trigger
- Seed data lengkap: 1 tenant, 3 cabang, 5 user, 12 produk, 30 hari transaksi

### File yang Dibuat/Diubah:
```
supabase/migrations/001_initial_schema.sql   ← 32 tabel, ENUMs, RLS, indexes, triggers
supabase/migrations/002_rls_policies.sql     ← granular policies + RBAC functions
supabase/migrations/003_seed_data.sql        ← demo data lengkap
```

### Catatan Teknis:
- Semua amounts dalam `BIGINT` (rupiah tanpa desimal)
- `profiles` tabel = extension dari `auth.users` (Supabase convention)
- Seed data memasukkan ke `auth.users` + `auth.identities` untuk menghindari FK constraint
- Migration dieksekusi via custom Node.js runner (`_migrate_runner.mjs`) karena Supabase CLI tidak support multi-statement SQL

---

## Fase 2 — Data Abstraction Layer (API) ✅ SELESAI

**Tujuan:** Memisahkan semua query Supabase dari komponen React. Kritis untuk migrasi ke Laravel.

### Arsitektur:
```
Komponen UI → Hooks → src/lib/api/ → Supabase → PostgreSQL
                                   ↕ (nanti diganti)
                                   Laravel API
```

### Prinsip:
- Setiap fungsi menerima `tenantId` sebagai parameter pertama
- Return pattern: `{ data: T, error: null } | { data: null, error: string }`
- Tidak ada business logic di API layer — hanya query
- `db` alias (`supabase as any`) untuk bypass TypeScript generic issues

### File yang Dibuat/Diubah:
```
src/types/database.ts             ← 32 TypeScript interfaces (snake_case, mirror PostgreSQL)
src/types/app.ts                  ← camelCase app types, ApiResponse<T>, enums, utils
src/lib/api/client.ts             ← wrapper Supabase: supabase, db, query(), queryMany(), rpc()
src/lib/api/tenants.ts            ← CRUD tenant + getTenantBySlug()
src/lib/api/branches.ts           ← CRUD cabang + getBranchesForUser()
src/lib/api/products.ts           ← CRUD produk + branch_products + adjustStock()
src/lib/api/customers.ts          ← CRUD customer
src/lib/api/transactions.ts       ← POS transactions: createTransaction(), getTransactions()
src/lib/api/inventory.ts          ← stock movements, opname, transfer
src/lib/api/purchasing.ts         ← PO, GR, supplier
src/lib/api/sales-orders.ts       ← SO + fulfillment
src/lib/api/finance.ts            ← kas, cash transactions
src/lib/api/receivables.ts        ← AR + payments
src/lib/api/payables.ts           ← AP + payments
src/lib/api/reports.ts            ← queries untuk laporan & dashboard
src/lib/api/auth.ts               ← login, logout, getCurrentUser()
src/lib/api/index.ts              ← barrel re-export semua API functions
```

---

## Fase 3 — State Management (Zustand) ✅ SELESAI

**Tujuan:** Global application state yang scalable untuk multi-tenant SaaS.

### Store yang dibuat:

| Store | State | Persistence |
|-------|-------|-------------|
| `auth.store` | currentUser, currentTenant, isLoading | localStorage |
| `branch.store` | branches[], activeBranch, isConsolidated | localStorage |
| `pos.store` | carts[] (max 5), activeCartIndex, activeSession | — |
| `offline.store` | txQueue, isOnline, syncStatus | IndexedDB (idb-keyval) |
| `notification.store` | notifications[], unreadCount, isConnected | — |

### Fitur khusus:
- `pos.store`: immer middleware, multi-cart (max 5), session management, offline fallback
- `offline.store`: IndexedDB persistence, window online/offline event listeners, retry logic
- `notification.store`: Supabase Realtime subscription + polling 5 menit untuk AR/AP/stok kritis
- `branch.store`: `setConsolidated()` hanya bisa diakses oleh role `owner`

### File yang Dibuat/Diubah:
```
src/stores/auth.store.ts          ← authentication state + login/logout/refreshUser
src/stores/branch.store.ts        ← branch management + consolidated view
src/stores/pos.store.ts           ← POS session, multi-cart, payment processing
src/stores/offline.store.ts       ← offline queue + IndexedDB sync
src/stores/notification.store.ts  ← in-app notifications + Realtime
src/stores/index.ts               ← barrel re-export semua stores
```

---

## Fase 4 — Multi-Tenant Routing ✅ SELESAI

**Tujuan:** Struktur routing yang mendukung multi-tenancy dengan URL `/{tenantSlug}/...`.

### Arsitektur routing:
```
/                         → redirect: login? → /{slug}/dashboard, else → /login
/login                    ← Supabase Auth + mock demo login
/onboarding/              ← 3-step onboarding flow untuk tenant baru
/$tenantSlug              ← LAYOUT: auth guard, tenant fetch, branch load, notif subscribe
/$tenantSlug/dashboard    ← semua role
/$tenantSlug/pos          ← owner, manager, cashier
/$tenantSlug/inventory/   ← semua authenticated
/$tenantSlug/inventory/products
/$tenantSlug/inventory/stock-opname
/$tenantSlug/inventory/stock-transfer
/$tenantSlug/sales-orders ← owner, manager, warehouse
/$tenantSlug/purchasing/  ← owner, manager, warehouse
/$tenantSlug/purchasing/purchase-orders
/$tenantSlug/purchasing/goods-receipt
/$tenantSlug/finance/     ← owner, manager, accountant
/$tenantSlug/finance/cash-book
/$tenantSlug/receivables  ← owner, manager, accountant
/$tenantSlug/payables     ← owner, manager, accountant
/$tenantSlug/reports/     ← owner, manager, accountant
/$tenantSlug/reports/sales
/$tenantSlug/reports/profit-loss  ← owner, accountant only
/$tenantSlug/reports/cashier-audit ← owner, manager only
```

### Guard functions (di `$tenantSlug.tsx`):
- `requireAuth()` — redirect ke `/login` jika belum login
- `requireRole(tenantSlug, roles[])` — redirect ke dashboard jika role tidak sesuai
- Dipanggil di `beforeLoad` setiap route (di luar React, via `useAuthStore.getState()`)

### File yang Dibuat/Diubah:
```
src/routes/__root.tsx                          ← +store init (refreshUser, initOfflineListeners)
src/routes/index.tsx                           ← smart redirect berdasarkan auth state
src/routes/login.tsx                           ← +beforeLoad guard, navigate ke /{tenantSlug}/...
src/routes/onboarding/index.tsx                ← 3-step onboarding (NEW)
src/routes/$tenantSlug.tsx                     ← LAYOUT ROUTE + requireAuth/requireRole helpers
src/routes/$tenantSlug/dashboard.tsx           ← dipindah dari /dashboard.tsx
src/routes/$tenantSlug/pos.tsx                 ← dipindah dari /pos.tsx
src/routes/$tenantSlug/sales-orders.tsx        ← stub (NEW)
src/routes/$tenantSlug/receivables.tsx         ← dipindah dari /receivables.tsx (hanya AR)
src/routes/$tenantSlug/payables.tsx            ← dipisah dari receivables (NEW)
src/routes/$tenantSlug/inventory/index.tsx     ← dipindah dari /inventory.tsx
src/routes/$tenantSlug/inventory/products.tsx  ← stub (NEW)
src/routes/$tenantSlug/inventory/stock-opname.tsx   ← stub (NEW)
src/routes/$tenantSlug/inventory/stock-transfer.tsx ← stub (NEW)
src/routes/$tenantSlug/purchasing/index.tsx    ← dipindah dari /purchasing.tsx
src/routes/$tenantSlug/purchasing/purchase-orders.tsx ← stub (NEW)
src/routes/$tenantSlug/purchasing/goods-receipt.tsx   ← stub (NEW)
src/routes/$tenantSlug/finance/index.tsx       ← dipindah dari /finance.tsx
src/routes/$tenantSlug/finance/cash-book.tsx   ← stub (NEW)
src/routes/$tenantSlug/reports/index.tsx       ← dipindah dari /reports.tsx
src/routes/$tenantSlug/reports/sales.tsx       ← stub (NEW)
src/routes/$tenantSlug/reports/profit-loss.tsx ← stub (NEW)
src/routes/$tenantSlug/reports/cashier-audit.tsx ← stub (NEW)
src/components/AppShell.tsx                    ← nav dinamis dengan tenantSlug dari Zustand
src/lib/api/tenants.ts                         ← +getTenantBySlug()
src/routeTree.gen.ts                           ← auto-generated oleh TanStack Router Vite plugin
```

---

## Fase 4.5 — Unifikasi Auth Layer ke Zustand ✅ SELESAI

**Tujuan:** Menghilangkan inkonsistensi auth sebelum lanjut ke Fase 5 — sebelumnya ada
dua sumber kebenaran auth yang berjalan paralel: context lama `src/lib/auth.tsx`
(dipakai 9 file) dan `src/stores/auth.store.ts` (Zustand, dipakai file lain).

### Yang dikerjakan:
- `auth.store.ts`: tambah `loginAsMock(role)` untuk login demo instan, dengan
  data user/tenant yang **ID-nya sama persis** dengan `supabase/migrations/003_seed_data.sql`
  (bukan ID acak) — supaya query Supabase lain (branches, notifications, reports)
  yang di-keyed oleh ID ini tetap konsisten secara konseptual dengan data seed asli.
- Tambah field `isAuthenticated: boolean` eksplisit di state; `refreshUser()`
  dijaga agar tidak menimpa sesi mock yang sedang aktif.
- `login.tsx`: dipindah total dari `useAuth()` (context lama) ke `useAuthStore`,
  3 tombol login cepat (Owner/Manager/Kasir) sesuai `loginAsMock(role)`.
- `$tenantSlug.tsx`: guard `requireAuth()` membaca `isAuthenticated` dari
  `auth.store`; ditambah bypass fetch tenant khusus slug demo `toko-simetri`
  supaya sesi mock tidak memicu network call yang akan gagal karena tidak ada
  JWT Supabase asli.
- Migrasi **9 file tambahan** yang masih memakai `useAuth()` context lama ke
  `useAuthStore`: `AppShell.tsx`, `__root.tsx` (hapus `AuthProvider`), dan 7
  halaman `$tenantSlug/*` (dashboard, pos, inventory, finance, receivables,
  payables, purchasing, reports). Tanpa ini, `AppShell` akan tetap membaca
  `user: null` meski `auth.store` sudah terisi → infinite redirect loop.
- Route duplikat di root (`src/routes/dashboard.tsx`, `pos.tsx`, dll — sisa
  struktur routing lama sebelum Fase 4) dikonfirmasi sudah terhapus, tidak ada
  komponen unik yang hilang.
- `src/lib/auth.tsx` (context lama) **sengaja dibiarkan ada tapi tidak dipakai**
  — akan dihapus di Fase 16 (cleanup) setelah auth Supabase asli berjalan penuh.

### Verifikasi:
- Login end-to-end (Playwright headless): `/login` → klik "Login sebagai Owner"
  → redirect ke `/toko-simetri/dashboard` → URL stabil, tidak ada redirect loop
  → 0 console error, 0 page error.

---

## Fase 5 — App Shell & Global UI ✅ SELESAI

**Tujuan:** Membangun komponen layout utama yang production-ready, bukan mock.

### Yang dikerjakan:
- **`src/components/layout/BranchSwitcher.tsx`** (NEW) — dropdown cabang dari
  `branch.store`, cabang aktif ditandai badge "Aktif"; opsi tambahan
  **"Semua Cabang (Konsolidasi)"** khusus role `owner` (mengaktifkan
  `setConsolidated()`).
- **`src/components/layout/OfflineIndicator.tsx`** (NEW) — banner merah saat
  `isOnline === false` ("⚠️ OFFLINE MODE — X transaksi menunggu sinkronisasi"),
  banner kuning + tombol "Sinkronkan Sekarang" saat online tapi masih ada
  antrian pending; otomatis hilang saat semua tersinkron.
- **`src/components/layout/NotificationPanel.tsx`** (NEW) — sheet dari kanan,
  daftar notifikasi dari `notification.store` dengan ikon+warna per tipe
  (stok kritis, piutang jatuh tempo, hutang jatuh tempo, rekonsiliasi, sync
  gagal), klik item → mark as read + navigate ke modul terkait, tombol
  "Tandai semua dibaca".
- **Dark mode**: `src/stores/theme.store.ts` (NEW, Zustand + persist) + toggle
  di top bar (ikon Sun/Moon); diterapkan via `useEffect` di `__root.tsx` (class
  `dark` di `<html>`) supaya konsisten di seluruh app termasuk halaman login.
- **Komponen UI reusable baru** (`src/components/ui/`): `status-badge.tsx`
  (badge status Lunas/Belum/Terlambat/Kritis/dll, dipetakan ke token warna
  tema), `currency-display.tsx` (format IDR konsisten, opsi compact & sign
  color), `date-display.tsx` (format tanggal Indonesia konsisten),
  `empty-state.tsx`, `loading-skeleton.tsx` (varian card/kpi/table-row/text/
  avatar-line).
- **`AppShell.tsx`** dirombak total: mengintegrasikan semua komponen di atas +
  menerapkan **warna aksen per modul** sesuai tabel PRD (Dashboard `blue-600`,
  POS `green-600`, Inventory `cyan-600`, Keuangan `emerald-600`, Piutang/Hutang
  `amber-600`, Pembelian `orange-600`, Laporan `violet-600`) pada nav item aktif.
- **Mock data pendukung demo**: `MOCK_BRANCHES` (auth.store.ts) dan
  `src/lib/mock-notifications.ts` — sesi `loginAsMock` tidak punya JWT Supabase
  asli sehingga query branch/notification asli diblokir RLS; kedua file ini
  men-seed data yang identik dengan seed SQL supaya BranchSwitcher &
  NotificationPanel tetap punya data realistis dalam mode demo.

### Bug kritis pre-existing yang ditemukan & diperbaiki (blocker Fase 5):
1. **Infinite render loop** ("Maximum update depth exceeded") — beberapa
   selector Zustand melakukan `.filter()` inline di dalam pemanggilan hook
   (`useStore((s) => s.list.filter(...))`), yang membuat array baru di setiap
   render dan memicu loop tak berhenti pada `useSyncExternalStore` React 19.
   Diperbaiki dengan `useMemo` di `AppShell.tsx` dan `NotificationPanel.tsx`.
2. **Navigasi sidebar rusak total** — seluruh link sidebar & beberapa link di
   dashboard memakai tag `<a href>` HTML native alih-alih `<Link>` TanStack
   Router, sehingga setiap klik memicu **full-page reload**. Karena sesi demo
   (`loginAsMock`) hanya tersimpan di `localStorage` browser (tidak terlihat
   oleh `beforeLoad` yang jalan di server saat SSR), full reload membuat guard
   auth gagal mendeteksi sesi → redirect paksa ke `/login`. Semua diganti ke
   `<Link to=... params=...>`.

### Isu diketahui (belum diperbaiki, tidak menghalangi Fase 6):
- **Hard-refresh (F5) di halaman `/{tenantSlug}/*` redirect ke `/login`**
  untuk sesi demo. Root cause: `beforeLoad` jalan di server (SSR) yang tidak
  punya akses ke `localStorage` browser tempat sesi mock disimpan. Navigasi
  normal di dalam app (klik menu) sudah 100% berfungsi — isu ini hanya
  muncul saat pengguna menekan reload/F5 manual. Akan relevan untuk
  diperbaiki bersamaan dengan Fase 15 (Authentication real) karena solusi
  idealnya adalah sesi Supabase Auth asli (dengan cookie httpOnly) yang
  terbaca di server, bukan patch sementara di localStorage.

### File yang Dibuat/Diubah:
```
src/components/layout/BranchSwitcher.tsx        ← NEW
src/components/layout/OfflineIndicator.tsx      ← NEW
src/components/layout/NotificationPanel.tsx     ← NEW
src/components/ui/status-badge.tsx              ← NEW
src/components/ui/currency-display.tsx          ← NEW
src/components/ui/date-display.tsx              ← NEW
src/components/ui/empty-state.tsx               ← NEW
src/components/ui/loading-skeleton.tsx          ← NEW
src/stores/theme.store.ts                       ← NEW (dark mode, persisted)
src/lib/mock-notifications.ts                   ← NEW (seed notifikasi demo)
src/components/AppShell.tsx                     ← rombak total, +Link fix
src/stores/auth.store.ts                        ← +MOCK_BRANCHES export
src/stores/branch.store.ts                      ← +bypass RLS untuk sesi mock
src/routes/__root.tsx                           ← +apply theme class ke <html>
src/routes/$tenantSlug/dashboard.tsx            ← <a href> → <Link> fix
```

### Verifikasi:
- `npx tsc --noEmit` — 0 error
- `npm run build` (production) — berhasil
- ESLint — 0 error (4 warning pre-existing tidak terkait perubahan)
- Playwright headless end-to-end: login → navigasi ke 6 modul (client-side,
  tanpa reload) → BranchSwitcher → NotificationPanel → dark mode toggle →
  mobile responsive (drawer sidebar) — semua lulus, 0 console error, 0 page
  error. Screenshot visual dikonfirmasi sesuai desain (warna aksen per modul,
  dark mode palette, notifikasi realistis).

---

## Fase 6 — Dashboard Module ✅ SELESAI

**Tujuan:** Halaman pertama yang dilihat owner/manager — KPI cards, grafik
penjualan, top produk, notifikasi aktif, ringkasan keuangan, mode konsolidasi.

### Yang dikerjakan:
- **`src/hooks/useDashboard.ts`** (NEW) — seluruh business logic dashboard
  dipindah ke sini sesuai Aturan 3 (Logic Separation): agregasi KPI per
  periode (Hari Ini/Minggu Ini/Bulan Ini + delta % vs periode sebelumnya),
  stok kritis/menipis, piutang jatuh tempo + jumlah pelanggan unik, saldo
  kas & bank, data grafik 30 hari, notifikasi aktif (dari `notification.store`),
  dan ringkasan per-cabang untuk mode konsolidasi. `dashboard.tsx` sekarang
  murni presentational — hanya memanggil hook ini dan merender hasilnya.
- **`src/routes/$tenantSlug/dashboard.tsx`** dirombak total mengikuti spesifikasi
  `CURSOR_INSTRUCTIONS.md` Fase 6 persis:
  - Header dengan greeting dinamis (Pagi/Siang/Sore/Malam) + period selector
    (Hari Ini / Minggu Ini / Bulan Ini) di area actions `AppShell`.
  - 4 KPI card: Penjualan [periode] (dengan trend vs periode sebelumnya),
    Produk Stok Kritis (CTA ke Inventory), Piutang Jatuh Tempo (CTA ke
    Piutang), **Saldo Kas & Bank** (sebelumnya keliru menampilkan "Laba
    Bersih" yang duplikat dengan section Ringkasan Keuangan — diperbaiki
    sesuai spesifikasi).
  - Grafik Tren Penjualan: `LineChart` Recharts warna biru (blue-600), 30
    hari tetap (bukan toggle 7/30 hari seperti implementasi sebelumnya).
  - Top 5 Produk Terlaris: diganti dari progress-bar manual menjadi
    horizontal `BarChart` Recharts dengan gradient cyan sesuai spesifikasi.
  - Notifikasi Aktif: sebelumnya card "Perlu Perhatian" menghitung ulang
    stok kritis/piutang secara manual (duplikasi logic dengan
    `mock-notifications.ts`) — diganti membaca langsung dari
    `notification.store` (sumber yang sama dipakai `NotificationPanel`),
    klik item menandai terbaca + navigasi ke modul terkait (reuse
    `entityRoute` yang di-export dari `NotificationPanel.tsx`).
  - Ringkasan Keuangan Bulan Ini: Laba Bersih ditonjolkan lebih besar +
    hijau sesuai spesifikasi ("highlight dengan warna hijau besar").
  - Mode Konsolidasi: tabel baru (khusus owner + `isConsolidated`) —
    Cabang/Revenue/Transaksi/Stok Kritis/Piutang Aktif + total row, klik
    baris memanggil `setActiveBranch()`. Data per-cabang disintesis dengan
    bobot deterministik (Sudirman 55%/Kebon Jeruk 30%/Bekasi 15%) dari total
    periode aktif — didokumentasikan di hook sebagai placeholder sampai
    `getBranchSummaries()` (sudah ada di `src/lib/api/reports.ts`) punya
    data transaksi per cabang sungguhan.
  - Loading skeleton (`LoadingSkeleton` variant kpi/avatar-line/text/table-row
    + `Skeleton` untuk area grafik) dan `EmptyState` di setiap section.
- **`src/stores/notification.store.ts`** — tambah state `isPanelOpen` +
  actions `openPanel()`/`closePanel()`/`setPanelOpen()` supaya
  `NotificationPanel` bisa dibuka dari halaman manapun (dipakai tombol
  "Lihat semua" di Dashboard), bukan hanya dari state lokal `AppShell`.
- **`src/components/AppShell.tsx`** — `notifOpen` dipindah dari `useState`
  lokal ke `notification.store` (state di atas).
- **`src/components/layout/NotificationPanel.tsx`** — export `entityRoute()`
  dan `NOTIFICATION_TYPE_CONFIG` (sebelumnya private) supaya bisa dipakai
  ulang oleh Dashboard tanpa duplikasi logic routing/ikon notifikasi.

### Bug ditemukan & diperbaiki (selama development, sebelum sempat ke user):
- **Infinite render loop** ("Maximum update depth exceeded") — draft awal
  `useDashboard` memakai selector `selectNotifications` (helper lama di
  `notification.store.ts` yang melakukan `.filter()` inline) langsung
  sebagai fungsi selector Zustand. Ini persis pola bug yang sudah pernah
  diperbaiki di Fase 5: `.filter()`/`.map()` inline di dalam pemanggilan
  hook Zustand membuat array baru setiap render → `useSyncExternalStore`
  React 19 mendeteksi "snapshot berubah terus" → loop tak berhenti.
  Diperbaiki dengan subscribe ke array mentah (`s.notifications`) lalu
  filter di dalam `useMemo` — pola yang sama seperti yang sudah benar di
  `NotificationPanel.tsx`.

### File yang Dibuat/Diubah:
```
src/hooks/useDashboard.ts                    ← NEW — business logic Fase 6
src/routes/$tenantSlug/dashboard.tsx         ← rombak total sesuai spesifikasi
src/stores/notification.store.ts             ← +isPanelOpen/openPanel/closePanel/setPanelOpen
src/components/AppShell.tsx                  ← notifOpen pindah ke notification.store
src/components/layout/NotificationPanel.tsx  ← export entityRoute() + NOTIFICATION_TYPE_CONFIG
```

### Verifikasi:
- `npx tsc --noEmit` — 0 error
- `npm run build` (production, client + SSR + nitro) — berhasil
- ESLint pada file yang diubah — 0 error baru (hanya 2 warning
  `react-refresh/only-export-components` pre-existing-pattern pada
  `NotificationPanel.tsx` karena file itu meng-export helper non-komponen;
  seluruh 13k+ error `prettier/prettier` yang muncul dari `npm run lint`
  adalah masalah line-ending CRLF pre-existing di seluruh repo, tidak
  terkait perubahan Fase 6)
- Dev server: dijalankan manual, sempat menangkap bug infinite loop di
  atas secara langsung dari console browser (bukan false alarm) — setelah
  fix, dipantau ~1 menit tanpa error berulang

---

## Fase 7 — POS Kasir ✅ SELESAI

**Tujuan:** Halaman kasir (POS) fungsional penuh — multi-cart, hold/takeover,
diskon, banyak metode pembayaran, cetak struk, buka/tutup shift — semuanya
lewat `pos.store.ts` (Fase 3) + `offline.store.ts` (offline-first), bukan lagi
mock data lokal di `pos.tsx`.

### Yang dikerjakan:

- **Mode demo vs tenant nyata**: karena `loginAsMock` (Fase 4.5) belum
  menghasilkan JWT Supabase Auth asli, semua write ke `cashier_sessions`,
  `sales_transactions`, `branch_products`, `customers` akan diblokir RLS untuk
  tenant mock (`MOCK_TENANT_ID`, di-export dari `auth.store.ts`). Pola yang
  sudah dipakai `branch.store.ts` (`MOCK_BRANCHES`) dan `mock-notifications.ts`
  diteruskan ke POS:
  - `src/lib/mock-pos-catalog.ts` (**NEW**) — katalog produk per cabang,
    daftar pelanggan, dan held cart sintetis diturunkan dari `mock-data.ts`
    tapi dibentuk ulang jadi tipe `BranchProductWithProduct`/`Customer` asli
    dari `types/database.ts`, supaya UI/hook tidak butuh cabang logic terpisah
    untuk data mock vs nyata.
  - `pos.store.ts` melacak `mockStockDelta` dan `mockCustomerDebtDelta`
    (in-memory, keyed by `product_id`/`customer_id`) yang diterapkan di atas
    data mock statis setiap kali transaksi selesai — supaya stok/piutang
    terlihat berkurang/bertambah secara real-time selama demo tanpa backend.
  - `getNextLocalTransactionSequence()` (**NEW**, `src/lib/api/transactions.ts`)
    — penomoran transaksi lokal in-memory untuk sesi mock & transaksi offline,
    menghindari panggilan RPC `getNextTransactionSequence()` yang akan gagal
    RLS.
  - Tenant nyata tetap lewat jalur Supabase penuh tanpa cabang kode berbeda —
    `usePos.ts`/`pos.store.ts` hanya bercabang berdasarkan flag
    `isMockTenant`/`isMockSession`, siap dihapus bersih di Fase 15.
- **`src/stores/pos.store.ts`** dirombak total: state sesi kasir
  (`activeSession`), 5 slot cart (`carts`/`activeCartIndex`), dan payment
  (`isProcessing`/`lastReceipt`) semua di satu tempat. `processPayment()`
  bercabang 3 arah — offline (queue ke `offline.store`), mock-online (delta
  in-memory), tenant nyata-online (`createTransaction`+`adjustStock`+
  `updateCustomer`) — tapi ketiganya menghasilkan struk (`lastReceipt`) yang
  format-nya identik untuk `ReceiptModal`.
- **`src/hooks/usePos.ts`** (**NEW**) — satu-satunya tempat business logic POS
  (Aturan 3: Logic Separation). Memuat katalog + pelanggan (mock atau API
  sesungguhnya), menggabungkan delta mock, expose held carts untuk takeover,
  dan seluruh callback cart/item/payment yang dipanggil `pos.tsx`.
- **8 komponen POS** (`src/components/pos/`) — semua presentational, terima
  props dari `usePos()`:
  - `OpenShiftModal` — input saldo kas awal, wajib sebelum kasir bisa
    transaksi (dialog tak bisa ditutup manual — `hideCloseButton` +
    `onInteractOutside`/`onEscapeKeyDown` di-preventDefault).
  - `CartTabs` — tab horizontal maks 5 cart, badge jumlah item, ikon gembok
    untuk cart yang di-hold.
  - `ProductCatalog` — search + filter kategori + grid produk dengan badge
    status stok (normal/menipis/kritis), klik kartu = tambah ke cart aktif.
  - `CartPanel` — daftar item (qty +/-, hapus), pemilih pelanggan (umum vs
    kredit), diskon toggle % / Rp, catatan order, tombol Hold/Kosongkan, +
    tombol "Ambil Alih Pesanan" bila ada held cart dari kasir lain.
  - `PaymentPanel` — ringkasan total, 5 metode bayar (Tunai/Kartu/QRIS
    varian/Transfer/Piutang), kalkulator kembalian tunai + tombol uang cepat,
    validasi limit kredit pelanggan, banner mode offline, tombol BAYAR.
  - `ReceiptModal` — preview struk gaya thermal-printer, tag
    `[OFFLINE — Pending Sync]` bila transaksi disimpan offline, tombol cetak
    (`window.print()`) + transaksi baru.
  - `CloseShiftModal` — ringkasan shift (total per metode bayar), input kas
    fisik, selisih otomatis (lebih/kurang), diblokir bila masih ada cart aktif
    belum dibayar.
  - `TakeoverModal` — tabel held cart kasir lain (nama kasir, pelanggan,
    total, waktu hold), tombol ambil alih memindahkan cart ke slot kosong
    kasir saat ini.
- **`src/routes/$tenantSlug/pos.tsx`** dirombak total dari mock data lokal
  menjadi murni presentational: render `OpenShiftModal` bila belum ada sesi
  aktif, lalu layout 2 kolom (`ProductCatalog` kiri ~60%, `CartTabs`+
  `CartPanel`+`PaymentPanel` kanan) + modal `ReceiptModal`/`TakeoverModal`/
  `CloseShiftModal`, semuanya digerakkan oleh `usePos()`.
- **`src/components/ui/dialog.tsx`** — tambah prop `hideCloseButton` di
  `DialogContent` (dipakai `OpenShiftModal` supaya kasir tidak bisa menutup
  modal wajib buka-shift lewat tombol X).
- **`src/stores/auth.store.ts`** — `MOCK_TENANT_ID` diubah jadi `export const`
  (sebelumnya private) supaya bisa dipakai `mock-pos-catalog.ts`,
  `pos.store.ts`, dan `usePos.ts` untuk deteksi sesi mock.
- **`src/lib/api/transactions.ts`** — tambah `getNextLocalTransactionSequence()`
  (lihat atas) dan `getHeldCartsInBranch()` (untuk `TakeoverModal` versi tenant
  nyata — mengambil cart status `hold` di cabang yang sama, exclude milik
  kasir sendiri).

### Dependency baru:
- **`immer`** (`^11.1.9`) — sebelumnya `pos.store.ts` sudah memakai
  `zustand/middleware/immer` tapi package `immer` itu sendiri belum pernah
  terinstall (tidak ketahuan sampai production build, karena `tsc`/dev server
  Vite tidak memvalidasi peer dependency ini). Ditambahkan via `npm install
  immer`, ter-lock di `package.json`.

### File yang Dibuat/Diubah:
```
src/lib/mock-pos-catalog.ts                  ← NEW — katalog/pelanggan/held-cart mock
src/hooks/usePos.ts                          ← NEW — business logic Fase 7
src/components/pos/OpenShiftModal.tsx        ← NEW
src/components/pos/CartTabs.tsx              ← NEW
src/components/pos/ProductCatalog.tsx        ← NEW
src/components/pos/CartPanel.tsx             ← NEW
src/components/pos/PaymentPanel.tsx          ← NEW
src/components/pos/ReceiptModal.tsx          ← NEW
src/components/pos/CloseShiftModal.tsx       ← NEW
src/components/pos/TakeoverModal.tsx         ← NEW
src/routes/$tenantSlug/pos.tsx               ← rombak total sesuai spesifikasi
src/stores/pos.store.ts                      ← rombak total — session/cart/payment orchestration
src/stores/auth.store.ts                     ← MOCK_TENANT_ID jadi export
src/lib/api/transactions.ts                  ← +getNextLocalTransactionSequence, +getHeldCartsInBranch
src/components/ui/dialog.tsx                 ← +hideCloseButton prop
package.json                                 ← +immer dependency
```

### Verifikasi:
- `npx tsc --noEmit` — 0 error
- `npx eslint` (file yang diubah) — 0 error, 0 warning (2 warning
  `react-hooks/exhaustive-deps` awal sudah diberi komentar penjelasan +
  di-review manual — dependency yang sengaja dikecualikan sudah benar)
- `npx vite build` (production, client + SSR + nitro) — berhasil setelah
  `immer` terinstall
- Dev server dijalankan manual — halaman `/login` merender 200 OK

---

## Fase 8 — Inventory & Stock ✅ SELESAI

**Tujuan:** Modul inventory lengkap — master barang, stock opname 3 langkah,
transfer antar cabang — mengikuti pola Fase 7 (hooks + mock layer demo).

### Yang dikerjakan:

- **Mode demo vs tenant nyata**: pola `isMockTenant`/`MOCK_TENANT_ID` sama
  seperti POS — `inventory.store.ts` + `mock-inventory.ts` menangani mutasi
  stok, opname, dan transfer in-memory; tenant nyata memanggil
  `src/lib/api/products.ts` + `src/lib/api/inventory.ts` langsung.
- **`src/stores/inventory.store.ts`** (NEW) — state runtime mock: penyesuaian
  stok per cabang (`mockStockAdjustments`), riwayat mutasi, daftar transfer,
  override produk, alur approval opname pending.
- **`src/lib/mock-inventory.ts`** (NEW) — seed mutasi stok + 3 transfer demo
  (draft/sent/received), generator nomor TRF/OPNAME.
- **`src/hooks/useInventoryProducts.ts`** (NEW) — filter/search, consolidated
  branch view, drawer detail + mutasi, form tambah/edit/nonaktifkan.
- **`src/hooks/useStockOpname.ts`** (NEW) — flow 3 langkah: setup → input stok
  fisik → review + estimasi kerugian; approval manager vs approve langsung.
- **`src/hooks/useStockTransfer.ts`** (NEW) — CRUD transfer draft → kirim →
  terima/batal; validasi qty ≤ stok cabang asal.
- **8 komponen inventory** (`src/components/inventory/`) — presentational:
  `ProductFilters`, `ProductTable`, `ProductDetailDrawer` (Sheet + tabs),
  `ProductFormModal`, `OpnameStepper`, `TransferList`, `TransferFormDialog`,
  `TransferDetailDialog`.
- **Routes** dirombak dari stub:
  - `inventory/index.tsx` → redirect ke `/inventory/products`
  - `inventory/products.tsx` → Master Barang penuh
  - `inventory/stock-opname.tsx` → stepper opname
  - `inventory/stock-transfer.tsx` → list + form + tracking status
- Stok efektif demo = katalog cabang + `pos.store.mockStockDelta` (penjualan
  POS) + `inventory.store.mockStockAdjustments` (opname/transfer).

### File yang Dibuat/Diubah:
```
src/lib/mock-inventory.ts                      ← NEW
src/stores/inventory.store.ts                  ← NEW
src/stores/index.ts                            ← +export inventory store
src/lib/mock-pos-catalog.ts                    ← export productId()
src/hooks/useInventoryProducts.ts              ← NEW
src/hooks/useStockOpname.ts                    ← NEW
src/hooks/useStockTransfer.ts                  ← NEW
src/components/inventory/ProductFilters.tsx    ← NEW
src/components/inventory/ProductTable.tsx      ← NEW
src/components/inventory/ProductDetailDrawer.tsx ← NEW
src/components/inventory/ProductFormModal.tsx  ← NEW
src/components/inventory/OpnameStepper.tsx     ← NEW
src/components/inventory/TransferList.tsx      ← NEW
src/components/inventory/TransferFormDialog.tsx ← NEW
src/components/inventory/TransferDetailDialog.tsx ← NEW
src/routes/$tenantSlug/inventory/index.tsx     ← redirect ke products
src/routes/$tenantSlug/inventory/products.tsx  ← rombak total
src/routes/$tenantSlug/inventory/stock-opname.tsx ← rombak total
src/routes/$tenantSlug/inventory/stock-transfer.tsx ← rombak total
```

### Verifikasi:
- `npx tsc --noEmit` — 0 error
- `npx vite build` (production, client + SSR + nitro) — berhasil

---

## Fase 9 — Sales Orders ✅ SELESAI

**Tujuan:** Modul Sales Order — list SO, form baru, split fulfillment stok/indent,
link PO indent, tracking status, konversi ke invoice AR.

### Yang dikerjakan:

- **Mode demo vs tenant nyata**: pola `isMockTenant`/`MOCK_TENANT_ID` — store
  in-memory + seed data; tenant nyata memanggil `src/lib/api/sales-orders.ts`.
- **`src/lib/mock-sales-orders.ts`** (NEW) — 4 SO seed (draft/confirmed/
  partial_delivered/completed) + helper nomor SO/PO-IND/Invoice.
- **`src/stores/sales-orders.store.ts`** (NEW) — CRUD mock, konfirmasi/batal,
  `processFulfillment()` (stok → kurangi `inventory.store`, indent → buat
  `PO-IND-*`), `convertToInvoice()`.
- **`src/hooks/useSalesOrders.ts`** (NEW) — business logic Fase 9.
- **3 komponen** (`src/components/sales-orders/`):
  `SalesOrderList`, `SalesOrderFormDialog`, `SalesOrderDetailDialog` (tabs
  Info | Fulfillment split stok/indent | PO Indent + link Pembelian).
- **`sales-orders.tsx`** dirombak total; **`AppShell`** + menu sidebar
  "Sales Order" (indigo, owner/manager/warehouse).

### Verifikasi:
- `npx tsc --noEmit` — 0 error
- `npx vite build` — berhasil

---

## Fase 10 — Purchasing & Goods Receipt ✅ SELESAI

**Tujuan:** Modul pembelian — PO reguler/indent, penerimaan barang, integrasi stok & SO.

### Routes:
- `/$tenantSlug/purchasing` → redirect ke `purchase-orders`
- `/$tenantSlug/purchasing/purchase-orders`
- `/$tenantSlug/purchasing/goods-receipt`

### Yang dikerjakan:
- **`src/lib/mock-purchasing.ts`** (NEW) — seed PO/GR, supplier lookup, ID helpers.
- **`src/stores/purchasing.store.ts`** (NEW) — CRUD mock PO, kirim/batal PO,
  `receiveMockGoods()` — reguler → `inventory.store.mockStockAdjustments`,
  indent → `sales-orders.store.confirmIndentGrReceived()` (stok toko tidak berubah).
- **`src/stores/sales-orders.store.ts`** — tambah `confirmIndentGrReceived()` untuk GR indent.
- **`src/hooks/usePurchaseOrders.ts`**, **`useGoodsReceipt.ts`** (NEW).
- **6 komponen** (`src/components/purchasing/`):
  `PurchasingSubNav`, `PurchaseOrderList`, `PurchaseOrderFormDialog`,
  `PurchaseOrderDetailDialog`, `GoodsReceiptList`, `GoodsReceiptFormDialog`.
- **`AppShell`** — link Pembelian → `/purchasing/purchase-orders`.
- PO indent dari Fase 9 (`PO-IND-*`) digabung via `getAllMockPos()`.

### Verifikasi:
- `npx tsc --noEmit` — 0 error
- `npx vite build` — berhasil

---

## Fase 11 — Finance & Cash Book ✅ SELESAI

**Tujuan:** Dashboard keuangan, buku kas, catat pengeluaran, P&L & cash flow dari transaksi.

### Routes:
- `/$tenantSlug/finance` — ringkasan saldo, P&L, grafik arus kas
- `/$tenantSlug/finance/cash-book` — buku kas + filter + catat pengeluaran

### Yang dikerjakan:
- **`src/lib/mock-finance.ts`** (NEW) — seed akun kas/bank & transaksi dari mock-data.
- **`src/lib/finance-calculations.ts`** (NEW) — `computeProfitLoss()`, `computeCashFlowSeries()`.
- **`src/stores/finance.store.ts`** (NEW) — saldo akun runtime, `recordMockExpense()`.
- **`src/hooks/useFinance.ts`**, **`useCashBook.ts`** (NEW).
- **6 komponen** (`src/components/finance/`):
  `FinanceSubNav`, `CashAccountCards`, `ProfitLossCard`, `CashFlowChart`,
  `CashBookList`, `ExpenseFormDialog`.
- Route finance dirombak dari mock inline → arsitektur hooks/store (pola Fase 8–10).

### Verifikasi:
- `npx tsc --noEmit` — 0 error
- `npx vite build` — berhasil

---

## Fase 12 ✅ SELESAI — Receivables & Payables

**Tujuan:** Aging AR/AP, status badge, catat pembayaran, detail customer, integrasi keuangan.

### Routes:
- `/$tenantSlug/receivables` — piutang pelanggan
- `/$tenantSlug/payables` — hutang supplier

### Yang dikerjakan:
- **`src/lib/ar-ap-utils.ts`** — aging buckets (0–30, 31–60, 61–90, >90), status Lunas/Sebagian/Belum/Terlambat
- **`src/stores/receivables.store.ts`** — `recordMockPayment()` → `recordMockIncome()` (kas bertambah)
- **`src/stores/payables.store.ts`** — `recordMockPayment()` → `recordMockExpense()` (kas berkurang, validasi saldo)
- **`src/hooks/useReceivablesPage.ts`**, **`usePayablesPage.ts`** — filter per cabang / konsolidasi
- **Komponen AR/AP** (`src/components/ar-ap/`):
  `AgingSummaryCard`, `ArApStatusBadge`, `ArApScopeBadge`, `ArPaymentDialog`, `ApPaymentDialog`, `CustomerDetailDialog`
- Halaman receivables & payables dirombak: aging 5 bucket, badge status, dialog bayar + pilih akun kas/bank, detail customer + riwayat bayar

### Verifikasi:
- `npm run build` — berhasil

---

## Fase 13 ✅ SELESAI — Reports Module

**Tujuan:** Laporan penjualan, P&L, audit kasir, selisih opname, export mock, filter cabang.

### Routes:
- `/$tenantSlug/reports` — hub navigasi + ringkasan
- `/$tenantSlug/reports/sales` — grafik + tabel penjualan + top produk
- `/$tenantSlug/reports/profit-loss` — P&L per periode
- `/$tenantSlug/reports/cashier-audit` — rekap kasir, void, diskon
- `/$tenantSlug/reports/stock-opname` — selisih opname + estimasi kerugian

### Yang dikerjakan:
- **`src/lib/reports-calculations.ts`** — sales, top produk, P&L, audit kasir, opname variance
- **`src/hooks/useReports.ts`** — scope cabang/konsolidasi, period filter
- **Komponen** (`src/components/reports/`):
  `ReportsSubNav`, `ExportReportButtons`, `ReportScopeBadge`
- Export PDF/Excel mock via toast di semua halaman laporan

### Verifikasi:
- `npm run build` — berhasil

---

---

## Fase 14 ✅ SELESAI — Onboarding Flow

**Tujuan:** Wizard 5 langkah untuk toko baru + progress tracker.

### Route:
- `/onboarding` — wizard setup lengkap

### Yang dikerjakan:
- **`src/stores/onboarding.store.ts`** — state persist (jalur, toko, user, produk)
- **`src/components/onboarding/OnboardingProgressWidget.tsx`** — floating tracker di AppShell
- Wizard 5 langkah: Pilih Jalur → Info Toko → User → Produk (4 jalur) → Go Live
- Jalur A–D: library produk, legacy mode, input buku, import Excel mock
- Menu "Lanjutkan Setup" di dropdown user

### Verifikasi:
- `npm run build` — berhasil

---

## Fase 15 ✅ SELESAI — PWA & Offline Capability

**Tujuan:** Service worker, IndexedDB cache, sync queue POS offline.

### Yang dikerjakan:
- **`vite-plugin-pwa`** + manifest Simetri ERP
- **`src/lib/offline/idb.ts`** — cache produk/customer + queue
- **`src/lib/offline/sync.ts`** — sync bulk + STOCK_DEFICIT/CREDIT_EXCEEDED alerts
- **`src/lib/offline/cache.ts`** — refreshCache setiap login/reconnect/6 jam
- **`src/lib/offline/init.ts`** — bootstrap cache listeners
- **`offline.store.ts`** — progress sync "Menyinkronkan X/Y", pesan sukses/gagal
- **`OfflineIndicator.tsx`** — banner offline, sync progress, Coba Lagi
- **`usePos.ts`** — katalog dari IndexedDB saat offline
- Struk POS: label `[OFFLINE — Pending Sync]` (sudah ada di ReceiptModal)

### Verifikasi:
- `npm run build` — berhasil (manifest.webmanifest + sw.js generated)

---

## Fase 16 ✅ SELESAI — Polish, RBAC & Testing

**Tujuan:** RBAC terpusat, empty states, hapus auth legacy.

### Yang dikerjakan:
- **`src/lib/rbac.ts`** — `canAccess`, `canEdit`, `canApprove` per fitur
- **`requireFeature()`** di route guards (P&L, audit kasir)
- **AppShell** nav filter via RBAC matrix
- **`useInventoryProducts`** / **`useStockOpname`** — permission via rbac
- **`src/components/ui/empty-state.tsx`** — komponen empty state reusable
- Hapus **`src/lib/auth.tsx`** (legacy mock auth provider)

### Verifikasi:
- `npm run build` — berhasil

---

## MVP Demo — SEMUA FASE SELESAI ✅

Fase 1–16 selesai. Aplikasi siap demo end-to-end.

---

## Fase Post-MVP — Penyempurnaan Fitur & Validasi Form 🔄

**Tujuan:** Menyempurnakan fitur satu per satu (UX, edge case, konsistensi data demo) dan menambah **validasi form** yang jelas di setiap modul — **tanpa** migrasi production ke Supabase dulu (tetap mock/localStorage + API layer siap nanti).

**Metode kerja (konvensi log):**
1. Pilih satu modul/fitur per iterasi.
2. Selesaikan → tandai ✅ di tabel backlog + tulis entri tanggal di **Log Pekerjaan Post-MVP**.
3. Verifikasi: uji manual singkat + `npm run build` jika ada perubahan kode.

### Backlog modul — validasi & polish

| Modul | Validasi form | UX / edge case | Status |
|-------|---------------|----------------|--------|
| Login & Pegawai | ⬜ | ✅ quick login + CRUD pegawai demo | 🔄 |
| Onboarding wizard | ⬜ | ✅ resume setup, cabang persist | 🔄 |
| Dashboard | ⬜ | ⬜ | ⬜ |
| POS Kasir | ⬜ | ✅ keterangan order, offline, struk, mobile keranjang | 🔄 |
| Histori Penjualan | ⬜ | ✅ DataTable + filter + kasir scope | ✅ |
| Pengiriman | ⬜ | ✅ dari checkout POS, status & driver | ✅ |
| Pelanggan (lokasi) | ⬜ | ✅ CRUD lokasi + riwayat POS | ✅ |
| Inventory | ⬜ | ⬜ | ⬜ |
| Sales Order | ⬜ | ✅ dari checkout POS (ikon paket) | 🔄 |
| Purchasing & GR | ⬜ | ✅ halaman load (infinite loop fix) | 🔄 |
| Finance & Kas | ⬜ | ⬜ | ⬜ |
| Piutang & Hutang | ⬜ | ⬜ | ⬜ |
| Laporan | ⬜ | ⬜ | ⬜ |
| Offline / PWA | ⬜ | ✅ sync demo + banner | 🔄 |

Legenda status: ⬜ belum · 🔄 sebagian · ✅ selesai untuk iterasi ini

---

### Log Pekerjaan Post-MVP

#### 2026-07-04 — P&L margin keuntungan + perbaikan catat pengeluaran ✅

**Margin keuntungan (ganti HPP):**
- P&L: **Total Margin Keuntungan** = Σ (subtotal − harga beli × qty) per baris penjualan POS
- HPP dihapus dari tampilan; % margin keuntungan & laba bersih terpisah
- Checkout POS tidak lagi menulis entri HPP ke buku kas

**Catat pengeluaran — dropdown akun kas/bank:**
- `modal={false}` + `z-[200]` pada Select di dalam Dialog
- Opsi akun teks biasa (`rupiah()`), filter `is_active` saja

**Verifikasi:** `npm run build` — berhasil

---

#### 2026-07-04 — Modul Keuangan: font angka konsisten + data dinamis ✅

**Font angka** — `CurrencyDisplay` memakai format `rupiah()` yang sama dengan checkout POS (`Rp 124.100`, tanpa `font-mono`), dengan wrapper `font-bold` / `text-2xl` di parent.

**P&L & HPP dari transaksi POS:**
- Pendapatan penjualan & HPP dihitung dari **histori penjualan POS** (`sales-transactions.store`) — `grandTotal` + `purchasePrice × qty` per baris (kecuali SO)
- Periode bulan pakai tanggal lokal (bukan UTC) agar transaksi hari ini masuk P&L
- Penagihan piutang tidak lagi dihitung sebagai penjualan
- Opex tetap dari buku kas (exclude HPP/Pembelian)

**Persist & sinkron:** finance/receivables/payables localStorage; bayar piutang ↔ limit kredit POS

**Verifikasi:** `npm run build` — berhasil

---

#### 2026-07-03 — Template download import Master Barang ✅

**Fitur:**
- Tombol **Template Import** di Master Barang (dropdown):
  - **Excel (.xlsx)** — multi-sheet: Panduan, Referensi Attribute, + 1 sheet per kategori (kolom menyesuaikan attribute aktif)
  - **CSV (.csv)** — satu file flat dengan kolom Kategori + union attribute + harga/stok
- Contoh baris per kategori + baris kosong siap isi; aturan validasi di sheet Panduan
- Template membaca attribute terkini dari store (termasuk custom dari Settings)

**File:** `src/lib/inventory-import-template.ts`, dependency `xlsx`

**Verifikasi:** `npm run build` — berhasil

---

#### 2026-07-03 — Smart Product Name Builder + Attribute Produk (Settings) ✅

**Fitur:**
- **Smart Product Name Builder** di form Tambah Produk — dropdown attribute bertingkat per kategori; nama & SKU terbentuk otomatis (nama masih bisa diedit manual)
- **SKU dari singkatan attribute** (contoh `PIP-PVC-34-RUC`) dengan deduplikasi otomatis
- **Material curah** — format nama `Jenis / Satuan` (mis. Pasir Lumajang / Truk vs Pikap = produk terpisah)
- **Settings → Master Data → Attribute Produk** — owner/manager CRUD attribute & nilai, reorder, nonaktifkan (localStorage `ses-product-attributes`)
- **Seed attribute** 7 kategori: Pipa & Sanitasi, Besi & Logam, Cat & Pelapis, Semen & Bahan Bangunan, Keramik & Lantai, Kayu & Triplek, Pasir & Material Curah
- Validasi harga jual > harga beli tetap aktif

**File utama:**
- `src/types/product-attributes.ts`, `src/lib/mock-product-attributes.ts`, `src/lib/product-name-builder.ts`
- `src/stores/product-attributes.store.ts`
- `src/components/inventory/SmartProductNameBuilder.tsx`
- `src/routes/$tenantSlug/settings/master-data/product-attributes.tsx`
- `src/components/settings/MasterDataSubNav.tsx`
- RBAC feature `settings` + nav **Pengaturan** di AppShell

**Verifikasi:** `npm run build` — berhasil

---

#### 2026-07-03 — POS SO: validasi COD, DP piutang, badge sidebar ✅

**Perbaikan & fitur:**
- **Pelanggan umum** boleh tandai barang SO (tanpa wajib pilih pelanggan)
- Ada barang SO → **COD dinonaktifkan** (auto ke Di Kirim)
- **Piutang + DP** — input down payment, sisa masuk piutang; limit dicek terhadap sisa
- **SO dari POS + piutang** — status pembayaran SO mengikuti DP (unpaid/partial/paid), bukan selalu lunas
- **Badge angka** di sidebar **Pengiriman** & **Sales Order** (item aktif per cabang)

**Verifikasi:** `npm run build` — berhasil

---

#### 2026-07-03 — Sales Order via checkout POS (ikon paket di keranjang) ✅

**Perubahan alur:**
- SO **tidak lagi** dibuat dari tombol "SO Baru" — modul SO = fulfillment saja
- Setiap baris keranjang: ikon **paket** → tandai barang **Sales Order / indent**
- **Satu struk** untuk semua barang (stok + SO); SO otomatis dibuat setelah bayar
- Barang SO: tidak kurangi stok, qty boleh melebihi stok, wajib pilih pelanggan
- Struk & histori penjualan menandai baris **· SO**
- Modul SO: kolom Ref. POS, detail "Checkout POS · TRX-..."

**Verifikasi:** `npm run build` — berhasil

---

#### 2026-07-03 — POS: perbaikan COD vs Pengiriman + lokasi/proyek di struk ✅

**Masalah:** Checkout COD kontraktor + proyek tetap masuk modul Pengiriman; lokasi hanya diposisikan untuk kirim.

**Perbaikan:**
- **COD tidak membuat DO** — modul Pengiriman hanya untuk **Di Kirim** & **Di Kirim Sebagian**
- **Lokasi / Proyek** tetap dipilih di COD (penanda struk & histori penjualan), tercetak di struk
- **Pelanggan Umum** + order Di Kirim → field alamat manual di keranjang (wajib sebelum bayar)
- Seed demo: hapus entri DO tipe COD

**Verifikasi:** `npm run build` — berhasil

---

#### 2026-07-03 — POS: lokasi pengiriman tersimpan (Fase B) ✅

**Yang dikerjakan:**
- **Last-used site** — `lastUsedSiteByCustomer` di store; preselect saat pilih pelanggan di POS (last → default → pertama)
- **Alamat manual** — opsi "Alamat lain (ketik manual)" + dialog **Simpan sebagai lokasi baru**
- **`recordLastUsedSite`** setelah checkout (kecuali mode manual)
- **Halaman Pelanggan** — `/$tenantSlug/customers` — daftar pelanggan + CRUD lokasi (owner/manager edit, accountant lihat)
- **`CustomerSiteFormDialog`**, **`useCustomerDeliverySitesPage`**
- RBAC feature **`customers`** + menu **Pelanggan** di AppShell
- Wiring POS: `PosCartColumn` + `usePos` → manual address & save site

**Verifikasi:** `npm run build` — berhasil

---

#### 2026-07-03 — POS: lokasi pengiriman tersimpan (Fase A) ✅

**Yang dikerjakan:**
- **`CustomerDeliverySite`** + segment pelanggan (umum, kontraktor, tukang/mandor, musiman, instansi)
- Seed demo: kontraktor 2 proyek aktif, musiman seasonal, instansi 2 lokasi, dll.
- **`DeliverySiteSelector`** di keranjang POS — pilih proyek/lokasi, default otomatis
- Snapshot **`deliverySiteLabel` + alamat** ke histori penjualan & modul pengiriman
- Filter site aktif by periode (`validFrom` / `validUntil`) & status proyek

**Verifikasi:** `npm run build` — berhasil

---

#### 2026-07-01 — POS: input qty langsung + kirim sebagian per barang ✅

**Yang dikerjakan:**
- **CartPanel** — field qty bisa diketik langsung (min 1, max stok), tetap ada tombol +/−
- **Di Kirim Sebagian** — checklist barang + input qty kirim per line
- Validasi: minimal 1 barang dicentang, qty 1..order, tidak boleh semua barang penuh (pakai "Di Kirim")
- **`partialShip`** di cart store → qty kirim diteruskan ke modul **Pengiriman** (bukan auto 60%)

**Verifikasi:** `npm run build` — berhasil

---

#### 2026-07-01 — POS: UX mobile keranjang & animasi tambah barang ✅

**Yang dikerjakan:**
- Mobile (`< lg`): keranjang disembunyikan dari bawah katalog — katalog full scroll tanpa terpotong
- Tombol **Keranjang** di header POS (badge jumlah item + total) → sheet slide-up berisi keranjang + bayar
- Animasi klik produk: pop ring, ikon centang hijau, label **+1** mengambang, tombol keranjang bump
- **`PosCartColumn.tsx`** — komponen bersama desktop & mobile sheet

**Verifikasi:** `npm run build` — berhasil

---

#### 2026-07-01 — Modul Pengiriman (baru) ✅

**Tujuan:** Pelacakan pengiriman material dari checkout POS — tanpa tombol buat manual di modul.

**Yang dikerjakan:**
- **`src/types/deliveries.ts`** — tipe record, status, draft checkout
- **`src/stores/deliveries.store.ts`** — persist `ses-deliveries`, seed demo, update status
- **`src/lib/mock-deliveries.ts`** + **`src/lib/delivery-utils.ts`** — seed & label status
- **`src/hooks/useDeliveriesPage.ts`** — scope cabang, filter tanggal/status
- **`src/components/deliveries/`** — DataTable, detail dialog, status badge
- **`src/routes/$tenantSlug/deliveries/index.tsx`** — halaman modul
- **`src/lib/rbac.ts`** — feature `deliveries` (owner, manager, cashier, warehouse — **tanpa accountant**)
- **`src/components/AppShell.tsx`** — menu Pengiriman
- **`src/stores/pos.store.ts`** — buat DO otomatis saat checkout (COD / Di Kirim / Di Kirim Sebagian)

**Verifikasi:** `npm run build` — berhasil

---

#### 2026-07-01 — Modul Histori Penjualan (baru) ✅

**Tujuan:** Daftar semua transaksi penjualan dengan filter fleksibel (localStorage demo).

**Yang dikerjakan:**
- **`@tanstack/react-table`** — dependency DataTable
- **`src/types/sales-transactions.ts`** — tipe record + `OrderFulfillmentType`
- **`src/stores/sales-transactions.store.ts`** — persist `ses-sales-transactions`, seed demo
- **`src/lib/mock-sales-transactions.ts`** — ~60 transaksi seed
- **`src/lib/api/sales-transactions.ts`** — layer API (mock store, stub Supabase nanti)
- **`src/hooks/useSalesTransactionsPage.ts`** — scope cabang + filter tanggal
- **`src/components/sales/SalesTransactionDataTable.tsx`** — sort, filter, pagination
- **`src/components/sales/SalesTransactionDetailDialog.tsx`** — detail line items
- **`src/routes/$tenantSlug/sales/transactions.tsx`** — halaman modul
- **`src/lib/rbac.ts`** — feature `sales_history`
- **`src/components/AppShell.tsx`** — menu Histori Penjualan
- **`src/stores/pos.store.ts`** — rekam transaksi ke histori saat checkout

**Verifikasi:** `npm run build` — berhasil

---

#### 2026-07-01 — POS: keterangan order checkout ✅

**Yang dikerjakan:**
- Pilihan **Keterangan Order** di `PaymentPanel`: COD · Di Kirim · Di Kirim Sebagian
- Field `orderFulfillmentType` di cart POS, struk (`ReceiptModal`), histori penjualan
- Label helper: `src/lib/sales-transaction-utils.ts` (`ORDER_FULFILLMENT_LABELS`)

**Verifikasi:** checkout POS → struk & histori menampilkan tipe order

---

#### 2026-07-01 — Histori Penjualan: akses kasir ✅

**Yang dikerjakan:**
- RBAC `sales_history` — tambah role **cashier**
- Kasir hanya melihat transaksi sendiri (`cashierId === user.id`)
- Subtitle halaman khusus kasir: "Riwayat transaksi penjualan Anda"

**Verifikasi:** login kasir → menu Histori Penjualan → hanya transaksi sendiri

---

#### 2026-07-01 — Offline POS: sync demo & banner ✅

**Masalah:** Sync mock ke Supabase → 400; banner hilang sebelum feedback sukses.

**Yang dikerjakan:**
- **`src/lib/offline/sync.ts`** — tenant demo skip POST Supabase (sync lokal)
- **`src/lib/offline/init.ts`** — hapus `syncQueue()` ganda on `online`
- **`src/stores/offline.store.ts`** — progress minimal, polling `navigator.onLine`, retry failed
- **`src/components/layout/OfflineIndicator.tsx`** — tombol Sinkronkan / Coba Lagi

**Verifikasi:** checkout offline → online → banner `✅ N transaksi tersinkron`

---

#### 2026-07-01 — Bugfix: Sales Order & Pembelian tidak load ✅

**Penyebab:**
1. `EmptyState` wajib `icon` → crash saat daftar kosong (SO/PO/GR/Transfer)
2. `usePurchaseOrders` — dependency `mockPurchaseOrders`/`mockSalesOrders` → infinite `loadOrders` (loading forever)

**Yang dikerjakan:**
- **`src/components/ui/empty-state.tsx`** — `icon` opsional (default `Inbox`)
- **`src/hooks/usePurchaseOrders.ts`** — hapus dependency array berulang pada `useEffect`
- Pesan empty state: data demo di **Cabang Sudirman**

**Verifikasi:** buka SO & PO di Cabang Sudirman → halaman render normal

---

#### 2026-07-01 — Bugfix sesi demo (sebelum Post-MVP, dicatat retroaktif) ✅

| Area | Fix |
|------|-----|
| Onboarding | `resumeOnboarding()`, default `isComplete: false`, cabang persist logout |
| Tenant guard | Mock session skip Supabase slug `tb-lumayan` |
| Login | Mock credentials **dulu**, Supabase fallback |
| Modul Pegawai | CRUD demo, RBAC owner, PIN login |
| Branch | `onboardingBranches` tidak dihapus saat logout |

---

### Iterasi berikutnya (belum dikerjakan)

Prioritas disarankan untuk validasi form:
1. **POS** — validasi nominal tunai, customer wajib untuk piutang, keterangan order wajib
2. **Sales Order / PO form** — zod + react-hook-form, qty > 0, tanggal delivery
3. **Pegawai** — email unik, PIN 6 digit, role wajib
4. **Onboarding** — validasi step per step sebelum lanjut
5. **Finance expense** — nominal, akun kas, kategori wajib

> Setiap item selesai → tambahkan entri dated ✅ di **Log Pekerjaan Post-MVP** di atas.

---

## Keputusan Arsitektur Penting

### 1. Data Flow
```
UI Components (render only)
    ↓ call
Custom Hooks (business logic)
    ↓ call
src/lib/api/ (query layer — ONLY place with Supabase calls)
    ↓ query
Supabase → PostgreSQL + RLS
```

### 2. Type System
- `src/types/database.ts` → snake_case, mirror exact PostgreSQL schema
- `src/types/app.ts` → camelCase, untuk dipakai di UI

### 3. Multi-Tenant
- Semua query wajib di-filter dengan `tenant_id`
- RLS sebagai safety net di database level
- `tenantSlug` di URL = single source of truth untuk context switching

### 4. Offline-First POS
- Transaksi offline masuk ke `offline.store.txQueue` (IndexedDB)
- Auto-sync ketika koneksi kembali
- `reconciliation_alerts` untuk deteksi anomali saat sync

---

## Dependency yang Terinstall

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "zustand": "^5.x",
    "idb-keyval": "^6.x",
    "framer-motion": "^12.x",
    "date-fns": "^4.x",
    "@tanstack/react-query": "^5.x",
    "@tanstack/react-router": "^1.x",
    "@tanstack/react-start": "^1.x",
    "@tanstack/react-table": "^8.x"
  }
}
```

---

## Supabase Project Info

- **Project URL:** (lihat `.env` → `VITE_SUPABASE_URL`)
- **Migrations dijalankan:** 001, 002, 003
- **Auth users terseed:** 5 user (Budi, Siti, Rudi, Andi, Dewi)
- **Tenant demo:** `slug: 'toko-simetri'`, `id: 11111111-0000-0000-0000-000000000001`
- **Mode login saat ini:** `loginAsMock(role)` + `loginWithMockCredentials(email, pin)` — bypass Supabase Auth untuk demo; data operasional mostly **localStorage / in-memory** (bukan production Supabase).
- **Post-MVP:** fokus polish + validasi form; migrasi Supabase Auth penuh **ditunda** sengaja.
