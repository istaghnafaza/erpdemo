# PROJECT_CONTEXT.md
# Selalu attach file ini di awal setiap sesi Cursor baru

---

## Identitas Project

**Nama:** SES — Simetri ERP Store
**Tipe:** SaaS ERP multi-tenant untuk toko bangunan di Indonesia
**Status:** Dalam development aktif

---

## Stack Teknis (JANGAN UBAH)

| Layer | Technology | Versi |
|-------|-----------|-------|
| Framework | TanStack Start + TanStack Router (file-based) | Latest |
| UI | React 19 + TypeScript (strict) | 19 |
| Styling | Tailwind CSS v4 + shadcn/ui | v4 |
| Charts | Recharts | Latest |
| State | Zustand v5 | 5.0.14 |
| Forms | React Hook Form + Zod | Latest |
| Tables | TanStack Table v8 | Latest |
| Backend | Supabase (PostgreSQL + Auth) | Latest |
| Client | @supabase/supabase-js | 2.110.0 |
| Animation | Framer Motion | 12.x |
| Routing | TanStack Router (file-based, $tenantSlug param) | Latest |
| Icons | Lucide React | 0.575.0 |
| Date | date-fns v4 (locale: id) | 4.x |
| Node | v24.18.0 | - |

**PENTING:** Ini TanStack Start + TanStack Router, BUKAN React Router v6.
File routing ada di `src/routes/` dengan struktur file-based.

---

## Arsitektur — 4 Aturan Wajib

### Aturan 1: API Layer Isolation
```
✅ BENAR: semua Supabase query hanya di src/lib/api/
❌ SALAH: supabase.from() langsung di komponen atau hooks
```
Alasan: memudahkan migrasi ke Laravel nanti — hanya folder api/ yang perlu diganti.

### Aturan 2: Tenant Isolation
```
✅ BENAR: semua query wajib filter .eq('tenant_id', tenantId)
❌ SALAH: query tanpa tenant_id filter
```
Alasan: SaaS multi-tenant — data antar toko tidak boleh bocor.

### Aturan 3: Logic Separation
```
✅ BENAR: business logic di src/hooks/, state di src/stores/
❌ SALAH: useState + useEffect + fetch di dalam komponen UI
```
Pattern yang benar:
```typescript
// hooks/useProducts.ts — logic di sini
export function useProducts() {
  const { activeBranch } = useBranchStore()
  return useQuery({
    queryKey: ['products', activeBranch?.id],
    queryFn: () => api.products.getAll(tenantId, activeBranch?.id)
  })
}

// components/ProductList.tsx — hanya render
export function ProductList() {
  const { products, isLoading } = useProducts()
  if (isLoading) return <LoadingSkeleton />
  return <Table data={products} />
}
```

### Aturan 4: TypeScript Strict
```
✅ BENAR: semua tipe explicit, interface dari src/types/
❌ SALAH: any, as any, @ts-ignore
```

---

## Struktur Folder (Target Akhir)

```
src/
├── routes/                    ← TanStack Router file-based
│   ├── __root.tsx
│   ├── index.tsx
│   ├── login.tsx
│   ├── onboarding/
│   │   └── index.tsx
│   └── $tenantSlug/           ← semua route bertenant di sini
│       ├── __layout.tsx       ← inject tenant context + auth guard
│       ├── dashboard.tsx
│       ├── pos.tsx
│       ├── inventory/
│       │   ├── index.tsx
│       │   ├── products.tsx
│       │   ├── stock-opname.tsx
│       │   └── stock-transfer.tsx
│       ├── sales-orders.tsx
│       ├── purchasing/
│       │   ├── index.tsx
│       │   ├── purchase-orders.tsx
│       │   └── goods-receipt.tsx
│       ├── finance/
│       │   ├── index.tsx
│       │   └── cash-book.tsx
│       ├── receivables.tsx
│       ├── payables.tsx
│       └── reports/
│           ├── index.tsx
│           ├── sales.tsx
│           ├── profit-loss.tsx
│           └── cashier-audit.tsx
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── BranchSwitcher.tsx
│   │   ├── OfflineIndicator.tsx
│   │   └── NotificationPanel.tsx
│   ├── pos/
│   │   ├── OpenShiftModal.tsx
│   │   ├── CartTabs.tsx
│   │   ├── ProductCatalog.tsx
│   │   ├── CartPanel.tsx
│   │   ├── PaymentPanel.tsx
│   │   ├── ReceiptModal.tsx
│   │   ├── CloseShiftModal.tsx
│   │   └── TakeoverModal.tsx
│   ├── dashboard/
│   ├── inventory/
│   ├── finance/
│   └── ui/                    ← shadcn + custom shared components
│       ├── StatusBadge.tsx
│       ├── CurrencyDisplay.tsx
│       ├── DateDisplay.tsx
│       ├── EmptyState.tsx
│       └── LoadingSkeleton.tsx
│
├── hooks/                     ← business logic, useQuery wrappers
│   ├── useAuth.ts
│   ├── useBranch.ts
│   ├── useProducts.ts
│   ├── useTransactions.ts
│   ├── useInventory.ts
│   ├── useFinance.ts
│   ├── useReceivables.ts
│   ├── usePayables.ts
│   ├── usePurchasing.ts
│   └── useReports.ts
│
├── stores/                    ← Zustand global state
│   ├── auth.store.ts
│   ├── branch.store.ts
│   ├── pos.store.ts
│   ├── offline.store.ts
│   ├── notification.store.ts
│   └── index.ts
│
├── lib/
│   ├── supabase.ts            ← Supabase client (SUDAH ADA)
│   ├── api/                   ← SEMUA Supabase queries di sini
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── tenants.ts
│   │   ├── branches.ts
│   │   ├── products.ts
│   │   ├── customers.ts
│   │   ├── transactions.ts
│   │   ├── inventory.ts
│   │   ├── purchasing.ts
│   │   ├── sales-orders.ts
│   │   ├── finance.ts
│   │   ├── receivables.ts
│   │   ├── payables.ts
│   │   ├── reports.ts
│   │   └── index.ts
│   ├── offline/               ← PWA & offline capability
│   │   ├── idb.ts
│   │   ├── sync.ts
│   │   └── cache.ts
│   ├── rbac.ts                ← role-based access control
│   └── utils.ts
│
├── types/
│   ├── database.ts            ← semua interface sesuai DB schema
│   └── app.ts                 ← camelCase types untuk UI
│
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql
        ├── 002_rls_policies.sql
        └── 003_seed_data.sql
```

---

## Database: Tabel yang Sudah Ada di Supabase

32 tabel telah dibuat via migration 001_initial_schema.sql:

**Tenant & Auth:** tenants, profiles, branches, user_branches

**Produk & Stok:** product_categories, products, branch_products,
stock_movements, stock_transfers, stock_transfer_items,
stock_opnames, opname_items

**POS:** customers, cashier_sessions, pos_carts,
sales_transactions, sales_items

**Pembelian:** suppliers, purchase_orders, purchase_order_items,
goods_receipts, goods_receipt_items

**Sales Order:** sales_orders, sales_order_items, so_fulfillments

**Keuangan:** cash_accounts, cash_transactions

**AR/AP:** accounts_receivable, ar_payments,
accounts_payable, ap_payments

**Offline:** offline_tx_queue, reconciliation_alerts,
reconciliation_alert_items

**Enums yang ada:** user_role, order_status, payment_method,
ar_payment_method, offline_flag, dan lainnya

**Semua tabel punya:** tenant_id (UUID, NOT NULL), created_at,
dan RLS policy yang aktif.

---

## Modul SES — 9 Modul Utama

| # | Modul | Route | Role yang Bisa Akses |
|---|-------|-------|---------------------|
| 1 | Dashboard | /dashboard | owner, manager, accountant |
| 2 | POS / Kasir | /pos | owner, manager, cashier |
| 3 | Inventory | /inventory/* | semua kecuali accountant |
| 4 | Sales Order | /sales-orders | owner, manager |
| 5 | Pembelian | /purchasing/* | owner, manager, warehouse |
| 6 | Keuangan | /finance/* | owner, manager, accountant |
| 7 | Hutang & Piutang | /receivables, /payables | owner, manager, accountant |
| 8 | Laporan | /reports/* | owner, manager, accountant |
| 9 | Customer Portal | (domain terpisah) | post-MVP |

---

## RBAC — Role & Akses

| Fitur Kritis | owner | manager | cashier | warehouse | accountant |
|-------------|-------|---------|---------|-----------|------------|
| Lihat semua cabang | ✅ | ❌ (hanya cabangnya) | ❌ | ❌ | ❌ |
| Mode konsolidasi | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit HPP (harga beli) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit harga jual | ✅ | ✅ | ❌ | ❌ | ❌ |
| Void transaksi | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve opname | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lihat harga beli | ✅ | ✅ | ❌ | ✅ | ✅ |
| Laporan keuangan | ✅ | ✅ | ❌ | ❌ | ✅ |

---

## Warna per Modul (Tailwind)

```
Dashboard   → blue-700
POS         → green-600
Inventory   → cyan-600
Keuangan    → emerald-600
AR/AP       → amber-600
Pembelian   → orange-600
Laporan     → violet-600
```

---

## Format Data Indonesia

```typescript
// Semua angka IDR: gunakan CurrencyDisplay component
// Contoh: Rp 1.250.000 (titik sebagai pemisah ribuan)
// Jangan: Rp1250000 atau Rp 1,250,000

// Semua tanggal: DD MMM YYYY
// Contoh: 15 Jan 2025
// Jangan: 2025-01-15 atau 01/15/2025

// Semua label UI: Bahasa Indonesia
// Contoh: "Tambah Produk", "Simpan", "Batal"
```

---

## Offline-First Rules (untuk POS)

1. `navigator.onLine` dipantau via `offline.store.ts`
2. Saat offline → transaksi POS masuk `offline_tx_queue` di IndexedDB
3. Data produk/harga/customer di-cache di IndexedDB via `src/lib/offline/cache.ts`
4. Background Sync via Service Worker (Chrome) + manual "Sinkronkan Sekarang" (iOS fallback)
5. Setelah sync → backend rekonsiliasi, flag `STOCK_DEFICIT` / `CREDIT_EXCEEDED`
6. Flag tampil di dashboard manager sebagai Reconciliation Alert

---

## Mock Data untuk Demo (Toko Bangunan Simetri)

Seed sudah ada di database. Gunakan data ini untuk referensi:

**Tenant:** toko-simetri
**Cabang:** Sudirman (utama), Kebon Jeruk, Bekasi
**Owner:** Budi Santoso
**Manager:** Siti Rahma (Sudirman+Kebon Jeruk), Rudi Hermawan (Kebon Jeruk+Bekasi)
**Kasir:** Andi Pratama (Sudirman)

**KPI Demo:**
- Penjualan hari ini: Rp 4.500.000 (47 transaksi)
- Stok kritis: 3 produk (Cat Tembok Putih, Kawat Beton, Bata Ringan Bekasi)
- Piutang jatuh tempo: Rp 12.000.000 (PT Abadi Jaya, terlambat 10 hari)
- Hutang supplier: Rp 33.500.000

---

## Migrasi ke Laravel (Roadmap, Bukan Sekarang)

Saat siap migrasi:
1. Hanya `src/lib/api/*.ts` yang perlu diubah
2. Ganti `supabase.from(...)` dengan `fetch('https://api.ses.id/...')`
3. Komponen, hooks, stores — tidak perlu disentuh
4. Database PostgreSQL tetap sama, hanya connection string berubah
