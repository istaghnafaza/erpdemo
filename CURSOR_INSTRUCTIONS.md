# Cursor AI — Master Build Instructions
# SES (Simetri ERP Store) — Full PRD Implementation

> **Cara pakai dokumen ini:**
> Kerjakan SATU FASE dalam satu sesi Cursor. Setelah setiap fase selesai,
> konfirmasi ke saya sebelum lanjut ke fase berikutnya.
> Jangan skip atau gabung fase — urutan ini penting untuk stabilitas.

---

## Konteks Proyek

**Proyek:** SES (Simetri ERP Store) — ERP SaaS multi-tenant untuk toko bangunan
**Stack:** TanStack Start + TanStack Router (file-based) + React 19 + TypeScript + Tailwind v4 + shadcn/ui
**Backend:** Supabase (PostgreSQL + Auth) — arsitektur disiapkan untuk migrasi ke Laravel
**Referensi PRD:** `PRD_-_SES_Simetri_ERP_Store.md` (spesifikasi lengkap)
**Target build saat ini:** Production-ready dari awal, bukan prototype

**Prinsip arsitektur yang WAJIB dijaga:**
1. Semua query Supabase hanya boleh ada di `src/lib/api/` — tidak boleh ada `supabase.from()` di komponen
2. Setiap entitas data WAJIB punya field `tenantId` — tidak ada data tanpa tenant
3. Business logic di React hooks (`src/hooks/`), bukan di komponen UI
4. Komponen UI hanya render — tidak boleh ada fetch, mutation, atau business logic

---

## FASE 0 — Persiapan Environment
### Kerjakan ini SEBELUM semua fase lain

```
Instruksi untuk Cursor:

Bantu saya menyiapkan environment development untuk proyek ini.
Lakukan hal-hal berikut secara berurutan:

1. Cek versi Node.js saat ini. Jika di bawah v20.19 atau v22,
   beri tahu saya untuk upgrade manual ke Node.js v22 LTS
   sebelum lanjut.

2. Buat file `.env.example` di root project dengan isi:
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_APP_NAME=SES Simetri ERP Store
   VITE_APP_ENV=development

3. Buat file `.env` (copy dari .env.example) — biarkan kosong dulu,
   saya akan isi manual dengan credentials Supabase.

4. Pastikan `.env` sudah ada di `.gitignore`.

5. Buat file `src/lib/supabase.ts` dengan konten:
   - Import createClient dari @supabase/supabase-js
   - Export supabase client menggunakan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
   - Tambahkan type-safety placeholder (kita akan generate types dari Supabase nanti)

6. Verifikasi semua package yang dibutuhkan sudah terinstall:
   - zustand ✓ (sudah ada)
   - @supabase/supabase-js ✓ (sudah ada)
   - framer-motion (install jika belum ada)
   - Konfirmasi tidak ada yang missing

Jangan jalankan dev server dulu. Setelah selesai, tampilkan
struktur folder yang sudah ada saat ini.
```

---

## FASE 1 — Database Schema (Supabase)
### Buat semua tabel sesuai PRD sebelum mulai coding frontend

```
Instruksi untuk Cursor:

Buat SQL migration script untuk Supabase berdasarkan
PRD SES. Buat file `supabase/migrations/001_initial_schema.sql`

Schema harus mencakup semua tabel berikut dengan field yang tepat.
PENTING: Setiap tabel WAJIB punya kolom `tenant_id UUID NOT NULL`
dengan foreign key ke tabel `tenants`.

TABEL YANG HARUS DIBUAT (urut dari parent ke child):

1. tenants
   - id, name, slug (unique), owner_email, phone
   - plan: enum('trial','basic','pro','enterprise')
   - trial_ends_at, is_active, onboarding_complete
   - legacy_mode_active (boolean)
   - created_at, updated_at

2. branches
   - id, tenant_id, code, name, address, phone
   - manager_id (nullable, FK ke users)
   - is_active, created_at

3. users (extend Supabase auth.users)
   - id (FK ke auth.users), tenant_id, name, email
   - role: enum('owner','manager','cashier','warehouse','accountant')
   - pin (varchar 6), is_active, created_at
   - (tabel ini bernama `profiles` mengikuti konvensi Supabase)

4. user_branches (many-to-many: user bisa di banyak cabang)
   - user_id, branch_id, tenant_id

5. product_categories
   - id, tenant_id, name, icon, created_at

6. products (master produk, terpusat per tenant)
   - id, tenant_id, sku (unique per tenant), barcode (nullable)
   - name, category_id, unit, purchase_price
   - is_active, created_at, updated_at

7. branch_products (stok & harga jual per cabang)
   - id, tenant_id, branch_id, product_id
   - selling_price, stock (integer, default 0)
   - legacy_stock (integer, default 0)
   - reorder_point, warehouse_location

8. cashier_sessions
   - id, tenant_id, branch_id, cashier_id
   - status: enum('open','closed')
   - opened_at, closed_at
   - opening_cash_balance, expected_cash_balance
   - actual_cash_balance, cash_discrepancy
   - total_sales, total_cash_sales, total_card_sales
   - total_transfer_sales, total_credit_sales
   - total_transactions, notes

9. pos_carts
   - id, tenant_id, branch_id, session_id, cashier_id
   - cart_number (1-5), customer_name, customer_id (nullable)
   - discount_percent, notes
   - status: enum('active','hold','paid','cancelled')
   - created_at, updated_at

10. customers
    - id, tenant_id, name, phone, address
    - type: enum('retail','credit')
    - credit_limit, outstanding_debt
    - created_at

11. sales_transactions
    - id, tenant_id, branch_id, session_id, cart_id
    - transaction_number (unique per tenant), customer_id (nullable)
    - customer_name, subtotal, discount_amount, tax_amount, grand_total
    - payment_method: enum('cash','card','qris_edc','qris_gopay','qris_ovo','qris_other','transfer','credit')
    - qris_provider (nullable varchar)
    - amount_paid, change_amount
    - input_by, paid_by, is_cross_session
    - has_legacy_items, is_offline_transaction
    - offline_created_at (nullable), sync_status
    - status: enum('completed','voided','returned')
    - notes, created_at

12. sales_items
    - id, transaction_id, tenant_id, product_id
    - product_name, sku, unit, qty
    - purchase_price, selling_price, discount, subtotal
    - stock_source: enum('verified','legacy','unverified')

13. stock_movements
    - id, tenant_id, branch_id, product_id
    - type: enum('in','out','adjustment','opname','transfer_out','transfer_in','legacy_in','legacy_out')
    - stock_source: enum('verified','legacy')
    - qty, qty_before, qty_after, reference, notes
    - user_id, created_at

14. stock_transfers
    - id, tenant_id, transfer_number (unique per tenant)
    - from_branch_id, to_branch_id
    - status: enum('draft','sent','received','cancelled')
    - notes, created_by, confirmed_by (nullable)
    - sent_at (nullable), received_at (nullable), created_at

15. stock_transfer_items
    - id, transfer_id, tenant_id, product_id
    - product_name, sku, unit
    - requested_qty, sent_qty, received_qty

16. suppliers
    - id, tenant_id, name, contact_person, phone
    - address, email, payment_term_days
    - outstanding_debt, is_active

17. purchase_orders
    - id, tenant_id, branch_id, po_number (unique per tenant)
    - type: enum('regular','indent')
    - sales_order_id (nullable FK)
    - supplier_id, delivery_address
    - subtotal, grand_total
    - status: enum('draft','sent','partial_received','received','cancelled')
    - expected_date, notes, created_by, created_at

18. purchase_order_items
    - id, po_id, tenant_id, product_id
    - product_name, sku, unit
    - ordered_qty, received_qty, purchase_price, subtotal

19. goods_receipts
    - id, tenant_id, branch_id, gr_number (unique per tenant)
    - purchase_order_id, supplier_id
    - received_by, received_at, notes

20. goods_receipt_items
    - id, gr_id, tenant_id, product_id
    - product_name, ordered_qty, received_qty, unit

21. sales_orders
    - id, tenant_id, branch_id, so_number (unique per tenant)
    - customer_id, customer_name, delivery_address
    - subtotal, discount_amount, grand_total
    - down_payment, remaining_payment
    - status: enum('draft','confirmed','partial_delivered','completed','cancelled')
    - payment_status: enum('unpaid','partial','paid')
    - estimated_delivery_date, notes, created_by, created_at

22. sales_order_items
    - id, so_id, tenant_id, product_id
    - product_name, sku, unit, qty
    - selling_price, discount, subtotal
    - delivered_qty
    - status: enum('pending','partial','fulfilled')

23. so_fulfillments
    - id, so_item_id, tenant_id
    - source: enum('stock','indent')
    - qty, purchase_order_id (nullable), supplier_id (nullable)
    - purchase_price_at_time
    - status: enum('planned','in_progress','delivered')

24. cash_accounts
    - id, tenant_id, branch_id, name
    - type: enum('cash','bank')
    - account_number (nullable), balance, is_active

25. cash_transactions
    - id, tenant_id, branch_id, cash_account_id
    - type: enum('income','expense','transfer')
    - category, amount, reference, description
    - user_id, created_at

26. accounts_receivable
    - id, tenant_id, branch_id, invoice_number (unique per tenant)
    - customer_id, customer_name, sales_transaction_id (nullable)
    - sales_order_id (nullable)
    - total_amount, paid_amount, remaining_amount
    - due_date
    - status: enum('unpaid','partial','paid','overdue')
    - created_at

27. ar_payments
    - id, ar_id, tenant_id, amount
    - payment_date, payment_method: enum('cash','transfer')
    - notes, user_id

28. accounts_payable
    - id, tenant_id, branch_id, invoice_number (unique per tenant)
    - supplier_id, supplier_name, purchase_order_id
    - total_amount, paid_amount, remaining_amount
    - due_date
    - status: enum('unpaid','partial','paid','overdue')
    - created_at

29. ap_payments
    - id, ap_id, tenant_id, amount, cash_account_id
    - payment_date, notes, user_id

30. offline_tx_queue (untuk sync offline transactions)
    - id, local_id (unique), tenant_id, branch_id, session_id
    - payload (jsonb — full SalesTransaction)
    - offline_created_at, sync_status: enum('pending','syncing','synced','failed')
    - retry_count, last_retry_at, server_tx_id (nullable)
    - flags (text array)

31. reconciliation_alerts
    - id, tenant_id, branch_id, triggered_at
    - total_flagged, is_resolved
    - resolved_by (nullable), resolved_at (nullable)

32. reconciliation_alert_items
    - id, alert_id, tenant_id, server_tx_id
    - cashier_name, flag: enum('STOCK_DEFICIT','CREDIT_EXCEEDED','PRICE_CHANGED')
    - product_name (nullable), customer_name (nullable)
    - detail, action_taken (nullable)

TAMBAHKAN JUGA:
- Row Level Security (RLS) untuk semua tabel: policy bahwa user hanya bisa akses
  row dengan tenant_id yang sama dengan tenant_id mereka
- Index pada: tenant_id, branch_id, created_at untuk semua tabel utama
- Trigger: updated_at otomatis diupdate saat row berubah
- Function: get_current_tenant_id() yang ambil dari JWT claims

Setelah SQL selesai, jangan jalankan dulu.
Tampilkan file SQL lengkap untuk saya review.
```

---

## FASE 2 — TypeScript Types & API Layer
### Buat type definitions dan abstraksi Supabase

```
Instruksi untuk Cursor:

Buat layer abstraksi yang memisahkan Supabase dari komponen React.
Ini KRITIS untuk memudahkan migrasi ke Laravel nanti.

1. Buat `src/types/database.ts`
   - Semua TypeScript interface sesuai PRD
   - Gunakan snake_case untuk field (sesuai PostgreSQL)
   - Semua interface punya field tenant_id
   - Export semua types

   Interface yang dibutuhkan (sesuai PRD):
   Tenant, Branch, Profile (User), UserBranch,
   Product, ProductCategory, BranchProduct,
   Customer, Supplier,
   CashierSession, PosCart, CartItem,
   SalesTransaction, SalesItem,
   StockMovement, StockTransfer, StockTransferItem,
   StockOpname, OpnameItem,
   PurchaseOrder, PoItem, GoodsReceipt, GrItem,
   SalesOrder, SalesOrderItem, SoFulfillment,
   CashAccount, CashTransaction,
   AccountReceivable, ArPayment,
   AccountPayable, ApPayment,
   OfflineTxQueue, ReconciliationAlert, ReconciliationAlertItem

2. Buat `src/types/app.ts`
   - camelCase versions dari database types (untuk dipakai di UI)
   - Helper type: ApiResponse<T>, PaginatedResponse<T>
   - Enum types: UserRole, OrderStatus, PaymentMethod, dll

3. Buat struktur folder `src/lib/api/` dengan file-file berikut:
   - `src/lib/api/client.ts` — wrapper Supabase dengan error handling standard
   - `src/lib/api/tenants.ts` — CRUD tenant
   - `src/lib/api/branches.ts` — CRUD cabang
   - `src/lib/api/products.ts` — CRUD produk + branch_products
   - `src/lib/api/customers.ts` — CRUD customer
   - `src/lib/api/transactions.ts` — POS transactions
   - `src/lib/api/inventory.ts` — stock movements, opname, transfer
   - `src/lib/api/purchasing.ts` — PO, GR, supplier
   - `src/lib/api/sales-orders.ts` — SO + fulfillment
   - `src/lib/api/finance.ts` — kas, cash transactions
   - `src/lib/api/receivables.ts` — AR + payments
   - `src/lib/api/payables.ts` — AP + payments
   - `src/lib/api/reports.ts` — query untuk laporan & dashboard
   - `src/lib/api/auth.ts` — login, logout, get current user

   Setiap fungsi di file-file ini harus:
   - Menerima tenantId sebagai parameter pertama
   - Return { data, error } pattern
   - Handle error secara konsisten
   - Tidak ada logic bisnis — hanya query

4. Buat `src/lib/api/index.ts` yang re-export semua API functions

PENTING: Semua fungsi harus menggunakan pattern ini:
\`\`\`typescript
export async function getProducts(tenantId: string, branchId?: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*, branch_products(*)')
    .eq('tenant_id', tenantId)
  
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}
\`\`\`

Ini memastikan saat migrasi ke Laravel, kita hanya ganti
isi fungsi ini dengan fetch() ke Laravel API — komponen tidak berubah.
```

---

## FASE 3 — Zustand Stores
### State management untuk semua modul

```
Instruksi untuk Cursor:

Buat Zustand stores untuk semua state global aplikasi.
Buat file-file berikut di `src/stores/`:

1. `src/stores/auth.store.ts`
   State: currentUser (Profile), currentTenant (Tenant), isLoading, error
   Actions: login(email, password), logout, refreshUser
   Persistence: localStorage (untuk remember session)

2. `src/stores/branch.store.ts`
   State: branches[], activeBranch (Branch | null), isConsolidated (bool)
   Actions: setBranches, setActiveBranch, setConsolidated
   Logic: owner bisa setConsolidated(true), role lain tidak bisa
   Persistence: localStorage (remember last active branch)

3. `src/stores/pos.store.ts`
   State:
   - carts: PosCart[] (max 5)
   - activeCartIndex: number
   - activeSession: CashierSession | null
   State ini TIDAK di-persist ke localStorage kecuali untuk offline queue

   Actions:
   - openSession(openingBalance)
   - closeSession(actualBalance)
   - addCart(), removeCart(index), switchCart(index)
   - holdCart(index), resumeCart(index)
   - addItemToCart(product, qty)
   - updateItemQty(cartIndex, itemIndex, qty)
   - removeItem(cartIndex, itemIndex)
   - setDiscount(cartIndex, percent)
   - setCustomer(cartIndex, customer)
   - processPayment(cartIndex, paymentMethod, amountPaid)
   - takeoverCart(cartId) — ambil alih dari kasir lain

4. `src/stores/offline.store.ts`
   State:
   - isOnline: boolean
   - txQueue: QueuedTransaction[]
   - syncStatus: 'idle' | 'syncing' | 'error'
   - lastSyncAt: Date | null
   - pendingCount: number

   Actions:
   - setOnline(status)
   - addToQueue(transaction)
   - syncQueue() — kirim semua pending ke API
   - clearSynced()

   Persistence: IndexedDB via idb-keyval
   (install idb-keyval jika belum ada)

   Event listeners:
   - window.addEventListener('online', ...) → setOnline(true) + syncQueue()
   - window.addEventListener('offline', ...) → setOnline(false)

5. `src/stores/notification.store.ts`
   State: notifications[] (in-app notifications)
   Actions: addNotification, dismissNotification, clearAll
   Logic: pull dari Supabase Realtime atau polling setiap 5 menit

Setelah semua store dibuat, buat `src/stores/index.ts`
yang re-export semua stores.
```

---

## FASE 4 — Routing & Auth Guard
### Multi-tenant routing dengan TanStack Router

```
Instruksi untuk Cursor:

Restructure routing untuk mendukung multi-tenant.
Gunakan TanStack Router file-based routing.

STRUKTUR ROUTE YANG DIINGINKAN:

src/routes/
├── __root.tsx          ← update: tambahkan global providers
├── index.tsx           ← redirect: jika logged in → /$tenantSlug/dashboard
│                                   jika belum → /login
├── login.tsx           ← tetap ada, update styling & logic
├── onboarding/
│   └── index.tsx       ← flow onboarding tenant baru
└── $tenantSlug/
    ├── __layout.tsx    ← PENTING: inject tenant context, cek auth
    ├── dashboard.tsx
    ├── pos.tsx
    ├── inventory/
    │   ├── index.tsx
    │   ├── products.tsx
    │   ├── stock-opname.tsx
    │   └── stock-transfer.tsx
    ├── sales-orders.tsx
    ├── purchasing/
    │   ├── index.tsx
    │   ├── purchase-orders.tsx
    │   └── goods-receipt.tsx
    ├── finance/
    │   ├── index.tsx
    │   └── cash-book.tsx
    ├── receivables.tsx
    ├── payables.tsx
    └── reports/
        ├── index.tsx
        ├── sales.tsx
        ├── profit-loss.tsx
        └── cashier-audit.tsx

LOGIKA DI $tenantSlug/__layout.tsx:
1. Ambil tenantSlug dari params
2. Cek apakah user sudah login (dari auth.store)
3. Jika belum login → redirect ke /login
4. Fetch tenant berdasarkan slug
5. Verifikasi user punya akses ke tenant ini
6. Set tenant di branch.store
7. Fetch branches yang accessible oleh user ini
8. Render children dengan tenant context

TAMBAHKAN beforeLoad guard di setiap route untuk cek:
- isAuthenticated
- hasRoleAccess(requiredRoles)

Contoh:
\`\`\`typescript
// di pos.tsx
export const Route = createFileRoute('/$tenantSlug/pos')({
  beforeLoad: ({ context }) => {
    const { user } = useAuthStore.getState()
    if (!['owner', 'manager', 'cashier'].includes(user?.role)) {
      throw redirect({ to: '/$tenantSlug/dashboard' })
    }
  }
})
\`\`\`

Jangan ubah konten halaman dulu — fokus ke routing dan guards.
```

---

## FASE 5 — App Shell & Global UI
### Layout, navigation, branch switcher

```
Instruksi untuk Cursor:

Update AppShell.tsx dan komponen layout global.

1. Update `AppShell.tsx`:
   - Sidebar dengan semua modul (icon + label)
   - Sidebar collapse di mobile (hamburger menu)
   - Top bar dengan:
     * Logo SES (kiri)
     * Branch Switcher (tengah-kiri) — dropdown pilih cabang
     * Global search placeholder (tengah) — bisa diimplementasi nanti
     * Notification bell dengan badge count
     * User menu (kanan): nama, role, logout

2. Buat `src/components/layout/BranchSwitcher.tsx`:
   - Dropdown list semua cabang yang accessible user
   - Jika owner: tambahkan opsi "Semua Cabang (Konsolidasi)" di bagian bawah
   - Cabang aktif ditampilkan dengan checkmark
   - Saat pilih cabang → update branch.store → semua halaman re-render dengan data baru
   - Tampilkan nama cabang aktif di top bar secara persisten

3. Buat `src/components/layout/OfflineIndicator.tsx`:
   - Banner merah di bawah top bar saat isOnline === false
   - Tampilkan: "⚠️ OFFLINE MODE — X transaksi menunggu sinkronisasi"
   - Tombol "Sinkronkan Sekarang" (manual sync)
   - Banner hilang otomatis saat kembali online + sync selesai

4. Buat `src/components/layout/NotificationPanel.tsx`:
   - Sheet/drawer dari kanan saat klik notification bell
   - List notifikasi dengan icon warna per tipe:
     🔴 Stok kritis (nama barang, cabang)
     🔴 Piutang jatuh tempo (nama customer, jumlah)
     🟡 Piutang H-3 jatuh tempo
     🔴 Hutang supplier jatuh tempo
     🔵 Transfer stok menunggu konfirmasi
   - Klik notifikasi → navigate ke modul terkait
   - "Tandai semua dibaca" button

5. Buat `src/components/ui/` tambahan yang dibutuhkan:
   - `StatusBadge.tsx` — badge warna untuk semua status (Lunas/Belum/Terlambat/dll)
   - `CurrencyDisplay.tsx` — format angka IDR yang konsisten
   - `DateDisplay.tsx` — format tanggal Indonesia yang konsisten
   - `EmptyState.tsx` — komponen empty state yang reusable
   - `LoadingSkeleton.tsx` — skeleton loading yang reusable

6. Update tema:
   - Pastikan dark mode toggle terhubung dan berfungsi
   - CSS variables untuk semua warna (sudah ada di Tailwind v4, pastikan dikonfigurasi)
   - Warna per modul sesuai PRD:
     Dashboard: blue-700
     POS: green-600
     Inventory: cyan-600
     Keuangan: emerald-600
     Hutang/Piutang: amber-600
     Pembelian: orange-600
     Laporan: violet-600

Setelah selesai, jalankan dev server dan screenshot hasilnya.
```

---

## FASE 6 — Dashboard Module
### Halaman pertama yang dilihat owner/manager

```
Instruksi untuk Cursor:

Bangun halaman Dashboard lengkap di `src/routes/$tenantSlug/dashboard.tsx`

DATA yang ditampilkan (gunakan mock data dulu, nanti diganti API):

1. HEADER
   - Greeting: "Selamat pagi, [nama]! 👋"
   - Tanggal hari ini
   - Period selector: [Hari Ini ▼] [Minggu Ini] [Bulan Ini]

2. KPI CARDS (4 cards, sejajar horizontal)
   Card 1 — Penjualan:
   - Label: "Penjualan [periode]"
   - Nilai: Rp 4.500.000 (format IDR)
   - Trend: ↑ +12.5% vs kemarin (hijau) atau ↓ -5% (merah)
   - Sub-info: "47 transaksi"

   Card 2 — Stok Kritis:
   - Label: "Produk Stok Kritis"
   - Nilai: "8 produk"
   - Warna: merah jika > 0
   - CTA: "Lihat →" navigate ke inventory filter stok kritis

   Card 3 — Piutang Jatuh Tempo:
   - Label: "Piutang Jatuh Tempo"
   - Nilai: Rp 12.400.000
   - Sub-info: "5 pelanggan"
   - Warna: merah jika ada

   Card 4 — Saldo Kas & Bank:
   - Label: "Total Saldo"
   - Nilai: Rp 76.800.000
   - Sub-info: total dari semua akun kas+bank

3. GRAFIK ROW (2 grafik, side by side)
   Kiri — Grafik Penjualan (line chart, Recharts):
   - X-axis: tanggal 30 hari terakhir
   - Y-axis: nominal IDR
   - Tooltip: tanggal, total, jumlah transaksi
   - Warna: blue-600

   Kanan — Top 5 Produk Terlaris (horizontal bar chart):
   - Produk vs jumlah terjual
   - Warna: gradient cyan

4. BOTTOM ROW (2 kolom)
   Kiri — Notifikasi Aktif (list):
   - Render dari notification.store
   - Max 5 item, "Lihat semua →" di bawah
   - Setiap item ada icon, pesan, dan timestamp
   - Click → navigate ke modul terkait

   Kanan — Ringkasan Keuangan Bulan Ini:
   - Penjualan: Rp 125.000.000
   - HPP: Rp 85.000.000
   - Laba Kotor: Rp 40.000.000 (32%)
   - Operasional: Rp 12.000.000
   - Laba Bersih: Rp 28.000.000 ← highlight dengan warna hijau besar
   - "Lihat Laporan Lengkap →"

5. MODE KONSOLIDASI (jika owner pilih "Semua Cabang"):
   Tambahkan tabel di bawah semua konten:
   - Kolom: Cabang, Revenue, Transaksi, Stok Kritis, Piutang Aktif
   - Baris per cabang
   - Total row di bagian bawah
   - Klik baris cabang → switch branch.store ke cabang tersebut

STYLING:
- Cards dengan shadow-sm, rounded-xl, border
- Angka besar dengan font-mono tabular-nums
- Loading state dengan skeleton untuk setiap section
- Empty state jika tidak ada data
- Fully responsive: mobile stack vertikal, desktop grid

Gunakan mock data yang realistic sesuai PRD mock data section.
```

---

## FASE 7 — POS Module
### Modul kasir — inti dari operasional toko

```
Instruksi untuk Cursor:

Bangun POS module di `src/routes/$tenantSlug/pos.tsx`
Ini adalah halaman paling kompleks — kerjakan dengan teliti.

KOMPONEN UTAMA yang perlu dibuat:

1. `src/components/pos/OpenShiftModal.tsx`
   - Modal yang muncul jika kasir belum buka shift
   - Input: saldo awal kas
   - Button: "Buka Shift & Mulai Transaksi"
   - Setelah submit → buat CashierSession baru di Supabase
   - Update pos.store.activeSession

2. `src/components/pos/CartTabs.tsx`
   - Tab bar horizontal: [🛒 #1 Pak Budi ●] [🛒 #2 Umum] [+]
   - Max 5 tab
   - Tab aktif: highlighted
   - Tab hold: warna abu, icon 🔒
   - Tab dengan item: dot indicator ●
   - Klik + → addCart()
   - Klik tab → switchCart(index)

3. `src/components/pos/ProductCatalog.tsx` (panel kiri, 40%)
   - Search bar (real-time filter dari IndexedDB cache)
   - Category chips/tabs horizontal scroll
   - Product grid: 2-3 kolom
   - ProductCard:
     * Icon/emoji kategori
     * Nama produk
     * Harga jual (format IDR)
     * Stok indicator: 🟢 ≥ reorderPoint, 🟡 < reorderPoint, 🔴 = 0
     * Satuan (sak, pcs, dll)
     * Button [+ Tambah]
   - Klik card atau button → addItemToCart()

4. `src/components/pos/CartPanel.tsx` (panel tengah, 40%)
   - List CartItem:
     * Nama produk
     * Stepper [-][qty][+]
     * Harga satuan
     * Subtotal
     * Tombol hapus [🗑]
   - Input diskon (% atau nominal, toggle)
   - Input catatan order
   - Customer selector (search dari daftar customer, atau ketik manual)
   - Tombol [🔒 Hold] dan [🗑 Kosongkan]
   - Tombol [🔄 Ambil Alih Pesanan] → modal list cart dari kasir lain

5. `src/components/pos/PaymentPanel.tsx` (panel kanan, 20%)
   - Summary: Subtotal, Diskon, Total
   - Payment method selector (icon buttons):
     💵 Tunai | 💳 Kartu | 📱 QRIS | 🏦 Transfer | 📋 Piutang
   - Jika QRIS dipilih → sub-selector: EDC / GoPay / OVO / Lainnya
   - Jika Tunai → input "Dibayar" + display "Kembalian" (auto-calc)
   - Jika Piutang → dropdown customer + tampilkan sisa limit
   - Button [BAYAR] besar, prominent, disabled jika form belum valid

6. `src/components/pos/ReceiptModal.tsx`
   - Modal setelah transaksi berhasil
   - Preview struk (format print-style, monospace)
   - Header: nama toko, alamat, telpon
   - Body: list item, qty, harga, subtotal
   - Footer: total, metode bayar, kembalian, nama kasir
   - Jika offline: tambahkan "[OFFLINE - Pending Sync]" kecil
   - Button: [🖨️ Cetak] (Web Bluetooth / window.print) | [Transaksi Baru]

7. `src/components/pos/CloseShiftModal.tsx`
   - Summary shift: total transaksi, breakdown per metode
   - Input "Kas Aktual" (hitung fisik)
   - Auto-hitung selisih (system vs aktual)
   - Jika selisih ≠ 0 → warning merah
   - Button: [Tutup Shift & Setor]

8. `src/components/pos/TakeoverModal.tsx`
   - Table: Kasir | Keranjang # | Customer | Total | Waktu Hold
   - Button [Ambil Alih] per baris
   - Setelah takeOver → cart pindah ke tab aktif kasir ini

LAYOUT UTAMA pos.tsx:
\`\`\`
Header bar: [Nama Kasir] [Cabang] [Shift Status] [Tutup Shift]
Cart Tabs: [#1 ●] [#2] [#3] [+]
──────────────────────────────────────────────────────────
[ProductCatalog 40%] | [CartPanel 40%] | [PaymentPanel 20%]
──────────────────────────────────────────────────────────
\`\`\`

OFFLINE BEHAVIOR:
- Jika offline, tambahkan banner di atas tabs
- Checkout tetap bisa dilakukan → tampilkan ForceCheckoutModal
- Transaksi masuk ke offline.store.txQueue
- Receipt tetap tampil dengan flag [OFFLINE]

IMPORTANT: Gunakan pos.store untuk semua state,
bukan local useState di komponen.
```

---

## FASE 8 — Inventory Module
### Stok, mutasi, opname

```
Instruksi untuk Cursor:

Bangun Inventory module dengan route dan komponen berikut:

ROUTES:
- `/$tenantSlug/inventory` → redirect ke /inventory/products
- `/$tenantSlug/inventory/products` → daftar produk
- `/$tenantSlug/inventory/stock-opname` → stock opname
- `/$tenantSlug/inventory/stock-transfer` → transfer antar cabang

HALAMAN PRODUCTS (`inventory/products.tsx`):

1. Header:
   - Title: "Master Barang"
   - Tombol: [Import Excel] [+ Tambah Produk]

2. Filter bar:
   - Search input (cari nama, SKU, barcode)
   - Filter kategori (dropdown)
   - Filter status stok: Semua | Kritis | Menipis | Normal | Habis
   - Filter cabang (jika mode konsolidasi)

3. Data table (TanStack Table):
   Kolom: SKU | Nama | Kategori | Stok | Min Stok | Harga Beli | Harga Jual | Lokasi | Aksi
   - Stok: tampilkan dengan warna (merah/kuning/hijau)
   - Harga Beli: hanya tampil jika role = owner/manager/warehouse/accountant
   - Aksi: [Lihat Mutasi] [Edit] [Nonaktifkan]
   - Klik baris → drawer detail produk

4. Drawer Detail Produk:
   - Info produk lengkap
   - Tab: Info | Mutasi Stok | Stok per Cabang
   - Riwayat mutasi stok: tanggal, tipe, qty, referensi, user

5. Modal Tambah/Edit Produk:
   - Form: SKU, Barcode (opsional), Nama, Kategori, Satuan
   - Harga Beli (hanya owner/manager)
   - Harga Jual per cabang
   - Stok awal, Reorder Point, Lokasi gudang
   - Toggle: legacy stock (onboarding mode)

HALAMAN STOCK OPNAME (`inventory/stock-opname.tsx`):

Flow 3 langkah dengan stepper UI:
Step 1: Setup → pilih kategori/semua, mulai sesi
Step 2: Input → tabel produk, kolom "Stok Fisik" bisa diisi
         Sistem tampilkan Stok Sistem vs Stok Fisik vs Selisih (auto-calc)
Step 3: Review → summary selisih, estimasi kerugian (selisih × HPP)
         Tombol: [Minta Approval Manager] / [Approve & Adjust] (jika manager)

HALAMAN STOCK TRANSFER (`inventory/stock-transfer.tsx`):

1. List transfer aktif (dengan status badge)
2. Tombol [+ Transfer Baru]
3. Form Transfer:
   - Dari Cabang / Ke Cabang (dropdown)
   - Tabel item: pilih produk, isi qty kirim
   - Validasi: qty kirim ≤ stok cabang asal
   - Catatan
4. Status tracking: Draft → Dikirim → Diterima / Dibatalkan
5. Tombol "Konfirmasi Terima" di sisi cabang tujuan
```

---

## FASE 9-13 — Modul Lanjutan
### Selesaikan semua modul tersisa

```
Instruksi untuk Cursor:

Bangun modul-modul berikut secara berurutan.
Setiap modul ikuti pola yang sama: route + komponen + integrasi store.

FASE 9 — Sales Order Module
Route: /$tenantSlug/sales-orders
Fitur:
- List SO dengan status badge
- Form SO baru: pilih customer, input item
- Split fulfillment UI: setiap item bisa set berapa dari stok, berapa indent
- Link ke PO Indent otomatis dari SO
- Status tracking lengkap
- Konversi SO ke Invoice (AR) saat selesai

FASE 10 — Purchasing Module
Routes: /purchasing, /purchasing/purchase-orders, /purchasing/goods-receipt
Fitur:
- List PO dengan filter tipe (reguler vs indent)
- Form PO: pilih supplier, tipe (reguler/indent), item
- Jika indent: input referensi SO + alamat kirim ke klien
- Goods Receipt: konfirmasi terima barang, qty actual
- GR reguler → stok cabang bertambah otomatis
- GR indent → stok toko TIDAK berubah, update status SO item

FASE 11 — Finance Module
Routes: /finance, /finance/cash-book
Fitur:
- Dashboard: saldo semua akun kas+bank
- Buku kas: list transaksi + filter periode
- Catat pengeluaran (form)
- Laporan cash flow (grafik masuk vs keluar)
- Laporan Laba Rugi:
  Penjualan - HPP = Laba Kotor
  Laba Kotor - Operasional = Laba Bersih
  Semua auto-calculated dari data transaksi

FASE 12 — Receivables & Payables Module
Routes: /receivables, /payables
Fitur AR:
- Tabel piutang dengan aging (0-30, 31-60, 61-90, >90 hari)
- Status badge: Lunas/Sebagian/Belum/Terlambat
- Catat pembayaran masuk
- Detail customer: semua piutang + riwayat bayar

Fitur AP:
- Sama seperti AR tapi untuk hutang ke supplier
- Catat pembayaran keluar (dari akun kas/bank mana)

FASE 13 — Reports Module
Routes: /reports, /reports/sales, /reports/profit-loss, /reports/cashier-audit
Fitur:
- Laporan Penjualan: grafik + tabel harian/mingguan/bulanan
- Top Produk Terlaris: bar chart + tabel
- Laporan Laba Rugi: per periode
- Audit Kasir: transaksi per kasir, void, diskon berlebihan
- Selisih Stock Opname: tabel selisih + estimasi kerugian
- Semua laporan: tombol Export PDF + Export Excel (mock dulu)
- Filter: cabang (single atau konsolidasi)
```

---

## FASE 14 — Onboarding Flow
### Setup wizard untuk toko baru

```
Instruksi untuk Cursor:

Bangun onboarding flow di `src/routes/onboarding/index.tsx`
Flow ini ditampilkan ketika tenant baru pertama kali login.

5-STEP WIZARD dengan stepper UI:

Step 1: Pilih Jalur
- 4 pilihan card (seperti di PRD):
  🆕 Toko Baru | 📦 Tidak Ada Catatan | 📒 Catatan Buku | 📊 Dari Excel
- Setiap card: icon, judul, deskripsi singkat, estimasi waktu setup

Step 2: Info Toko & Cabang
- Form: nama toko, alamat, telepon, NPWP (opsional)
- Nama cabang pertama (default: "Cabang Utama")
- Alamat cabang

Step 3: Tambah User
- Form tambah kasir (minimal 1)
- Nama, email, PIN 6 digit
- Role selection
- Bisa skip jika hanya owner yang pakai dulu

Step 4: Tambah Produk (BERBEDA per jalur)
- Jalur A (Baru): Library Produk Toko Bangunan
  * Grid produk umum dengan checkbox
  * Input harga jual per produk yang dicentang
  * Stok awal (opsional)
- Jalur B (Tidak Ada Catatan):
  * Form singkat + toggle "Aktifkan Legacy Stock Mode"
  * Instruksi: "Isi produk yang kamu jual, stok bisa dikosongkan dulu"
- Jalur C (Buku):
  * Form input massal (tabel dengan banyak baris)
  * Bisa tambah baris baru dengan Enter
  * Progress tracker per kategori
- Jalur D (Excel):
  * Download template button
  * Upload zone (drag & drop)
  * Preview + error validation per baris
  * Import yang valid, skip yang error

Step 5: Selesai & Go Live
- Checklist yang sudah selesai
- Ringkasan: X produk, X cabang, X user
- Tombol besar: "Mulai Gunakan SES! 🚀"
- Navigate ke dashboard

PROGRESS TRACKER (sidebar kecil):
Tampilkan di semua halaman setelah onboarding jika belum complete:
- Progress bar (68% selesai)
- Checklist item per langkah
- Link "Lanjutkan Setup"
- Bisa di-dismiss (hidden tapi masih bisa dibuka dari menu)
```

---

## FASE 15 — PWA & Offline Capability
### Service worker, IndexedDB, background sync

```
Instruksi untuk Cursor:

Implementasikan offline-first capability untuk modul POS.

1. Setup PWA dengan vite-plugin-pwa:
   Install: npm install -D vite-plugin-pwa
   
   Update vite.config.ts:
   - Tambahkan VitePWA plugin
   - Konfigurasi manifest: nama, ikon, warna
   - Cache strategy:
     * App shell → CacheFirst
     * API calls → NetworkFirst dengan fallback
     * Static assets → StaleWhileRevalidate

2. Setup IndexedDB dengan idb-keyval (atau idb):
   Install jika belum ada: npm install idb-keyval
   
   Buat `src/lib/offline/idb.ts`:
   - Store: products, branch_products, customers, active_session
   - Store: tx_queue (transaksi offline)
   - Fungsi: saveProducts, getProducts, saveCustomers, dll
   - Fungsi: addToQueue, getQueue, removeFromQueue, clearSynced

3. Update pos.store untuk offline:
   - Saat addItemToCart: gunakan data dari IndexedDB jika offline
   - Saat processPayment offline: simpan ke tx_queue (idb + zustand)
   - Saat kembali online: trigger syncQueue()

4. Buat `src/lib/offline/sync.ts`:
   - Fungsi syncQueue(): ambil semua 'pending' dari queue
   - Kirim bulk ke API endpoint
   - Update status tiap item: synced / failed
   - Handle STOCK_DEFICIT dan CREDIT_EXCEEDED flags dari response
   - Jika ada flags → tambahkan ke reconciliation alerts

5. Buat `src/lib/offline/cache.ts`:
   - Fungsi refreshCache(tenantId, branchId):
     * Fetch products dari Supabase
     * Fetch branch_products dari Supabase
     * Fetch customers dari Supabase
     * Simpan ke IndexedDB
   - Panggil refreshCache() saat:
     * User pertama kali login
     * Kembali online setelah offline
     * Setiap 6 jam (setInterval)

6. Update OfflineIndicator:
   - Tampilkan progress saat sync berjalan: "Menyinkronkan 3/5..."
   - Tampilkan sukses: "✅ Tersinkron"
   - Tampilkan error: "❌ Gagal sync 1 transaksi [Coba Lagi]"

7. Update Receipt:
   - Jika transaksi dari queue (isOfflineTransaction = true):
     Tampilkan kecil di bawah struk: "[OFFLINE - Pending Sync]"
   - Setelah sync berhasil: label hilang otomatis (update dari store)
```

---

## FASE 16 — Polish, RBAC & Testing
### Final polish sebelum demo

```
Instruksi untuk Cursor:

Selesaikan semua detail terakhir sebelum aplikasi siap demo.

1. RBAC ENFORCEMENT:
   Buat `src/lib/rbac.ts` dengan fungsi:
   - canAccess(role, feature): boolean
   - canEdit(role, feature): boolean
   - canApprove(role, feature): boolean
   
   Implementasikan di setiap:
   - Route beforeLoad guard
   - Tombol aksi (disabled jika tidak punya akses)
   - Kolom tabel (hidden jika tidak punya akses, contoh: Harga Beli)

2. EMPTY STATES:
   Pastikan semua halaman punya empty state yang proper:
   - Icon ilustrasi sederhana (gunakan Lucide)
   - Pesan yang helpful dan casual Indonesian
   - CTA button jika relevan

3. LOADING STATES:
   - Skeleton untuk semua tabel dan KPI cards
   - Spinner untuk form submission
   - Optimistic updates untuk aksi yang cepat (tambah ke cart)

4. ERROR HANDLING:
   - Toast notification untuk semua error dan success
   - Form validation errors yang jelas
   - Network error handling dengan retry option

5. DARK MODE:
   - Pastikan toggle berfungsi
   - Semua komponen konsisten di dark mode
   - Simpan preference ke localStorage

6. RESPONSIVE:
   - Mobile: sidebar collapse, POS layout stack vertikal
   - Tablet: sidebar mini (icon only), POS 2 panel
   - Desktop: full layout 3 panel

7. MOCK DATA CONSISTENCY:
   Pastikan angka di semua modul KONSISTEN:
   - Total penjualan di Dashboard = total di Laporan
   - Stok di Inventory = stok yang berkurang saat transaksi POS
   - Piutang di Dashboard = piutang di modul AR

8. FINAL CHECKLIST:
   Jalankan demo flow dari PRD_-_SES_MVP_Demo.md:
   - Login sebagai owner → dashboard → semua data tampil
   - Switch ke kasir → POS → complete 1 transaksi
   - Switch ke manager → lihat laporan audit kasir
   - Cek semua notifikasi muncul (stok kritis, piutang jatuh tempo)
   - Cek dark mode toggle
   - Cek di mobile viewport (375px)
```

---

## Catatan Penting untuk Setiap Fase

### Sebelum mulai setiap fase, selalu:
1. Baca instruksi fase tersebut sampai habis sebelum mulai coding
2. Konfirmasi pemahaman dengan meringkas apa yang akan dikerjakan
3. Jika ada yang ambigu, tanya dulu sebelum eksekusi

### Standar code quality:
- Semua komponen: TypeScript strict, tidak ada `any`
- Semua teks UI: Bahasa Indonesia
- Semua angka IDR: gunakan `CurrencyDisplay` component
- Semua tanggal: gunakan `DateDisplay` component
- Tidak ada console.log di production code
- Setiap komponen punya loading state dan error state

### Pola yang harus konsisten:
```typescript
// ✅ BENAR — logic di hook
function useProducts() {
  const { activeBranch } = useBranchStore()
  const { data, isLoading } = useQuery({
    queryKey: ['products', activeBranch?.id],
    queryFn: () => api.products.getAll(tenantId, activeBranch?.id)
  })
  return { products: data, isLoading }
}

// ❌ SALAH — fetch langsung di komponen
function ProductList() {
  const [products, setProducts] = useState([])
  useEffect(() => {
    supabase.from('products').select('*') // JANGAN!
  }, [])
}
```

### Migrasi ke Laravel nanti:
Saat sudah siap migrasi, HANYA file-file di `src/lib/api/` yang perlu diubah.
Ganti `supabase.from(...)` dengan `fetch('https://api.ses.id/...')`.
Semua komponen, hooks, dan stores tidak perlu disentuh.
