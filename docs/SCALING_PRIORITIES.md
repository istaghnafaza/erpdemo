# SEPS — Prioritas Teknis Skalabilitas Multi-Tenant

Dokumen ini memetakan **prioritas implementasi** agar SEPS aman, lancar, dan cepat saat dipakai **banyak toko × banyak user**. Berdasarkan arsitektur aktual: **Browser → TanStack Server Fn (Railway) → Neon PostgreSQL**.

**Target audience:** tim dev sebelum scale 10 → 200+ tenant.

---

## 1. Ringkasan eksekutif

| Pertanyaan | Jawaban singkat |
|------------|-----------------|
| Apakah "request server terus" jadi masalah? | **Ya**, jika pola baca tidak di-cache/batch — beban naik **linear** dengan user aktif |
| Apakah request server salah? | **Tidak** — POS, stok, auth **harus** ke server; yang perlu dioptimasi adalah **baca data master & laporan** |
| Bottleneck utama hari ini | Hook modul berat sudah di-batch; sisa: keuangan, PO/SO list, laporan cashier/opname |
| Quick win terbesar | TanStack Query `staleTime` + **1 endpoint bundle** per layar berat |
| Quick win skala multi-toko | **Redis/Upstash** cache server per `tenant_id` + `branch_id` |

---

## 2. Baseline — status implementasi (Juli 2026)

| Area | Status | File / pola |
|------|--------|-------------|
| Auth sync throttle | ✅ 45 detik | `src/lib/auth-sync-cache.ts`, `auth-bootstrap.ts` |
| Cache cabang (client) | ✅ 60 detik | `src/stores/branch.store.ts` |
| Cache produk/pelanggan (client) | ✅ 30 detik | `src/lib/api/response-cache.ts` |
| Checkout POS 1 round-trip (Neon) | ✅ nomor TRX di server | `src/server/services/transactions.ts`, `pos.store.ts` |
| Isolasi tenant server | ✅ `assertTenant(session, tenantId)` | `src/server/auth/request-session.ts`, `neon/*.ts` |
| Index DB `tenant_id` | ✅ kebanyakan tabel | `neon/phase*.sql` |
| TanStack Query global | ✅ defaults 2 menit | `src/lib/query-client.ts`, `src/router.tsx` |
| useQuery — Dashboard, POS, Inventori, Laporan, Keuangan, SO, PO, Buku Kas | ✅ | hooks di `src/hooks/use*.ts` |
| Dashboard bundle (1 request) | ✅ | `neonGetDashboardBundle`, `getDashboardBundle` |
| Reports bundle (1 request) | ✅ | `neonGetReportsBundle`, `getReportsBundle` |
| Finance overview bundle (1 request) | ✅ | `neonGetFinanceOverview`, `getFinanceOverview` |
| Multi-branch products (1 request) | ✅ | `neonGetBranchProductsMulti`, `getBranchProductsMulti` |
| Server cache Redis/Upstash | ✅ | `src/server/cache/*` — bp, categories, customers, branches, suppliers |
| Cache server `branches` | ✅ | `src/server/services/branches.ts` |
| Rate limit login + PIN + register | ✅ Redis when Upstash configured | `rate-limit.ts`, `server-fn-rate-limit.ts` |
| Rate limit heavy server fn (bundle) | ✅ partial | dashboard, reports, finance overview |
| Prefetch sidebar (POS, Inventori, Keuangan, SO, PO) | ✅ | `prefetch-module-queries.ts`, `AppShell.tsx` |
| Nav badges Neon (SO + deliveries + online) | ✅ schema | `nav-counts.ts` — badge >0 setelah data Neon ada |
| IndexedDB warm POS | ✅ | `pos-catalog-warm.ts`, `usePos.ts` |
| Index `(tenant_id, branch_id)` branch_products | ✅ applied Neon | `neon/phase2_index_branch_products_tenant_branch.sql` |
| Daily aggregates `daily_branch_sales` | ✅ | `neon/phase8_schema.sql`, `rollup-daily-sales.mjs` |
| Read replica routing | ✅ optional | `DATABASE_URL_REPLICA`, `getReadDb()` |
| Audit log void sale | ✅ partial | `audit_events`, `audit-log.ts` |
| Health ops metrics | ✅ | cache hit rate, replica flag, aggregate rows |

---

## 3. Matriks prioritas (P0 → P3)

### P0 — Lakukan dulu (impact tinggi, effort sedang)

| # | Item | Modul terdampak | Status | Mengurangi request? |
|---|------|-----------------|--------|---------------------|
| P0-1 | **TanStack Query global** — `staleTime` 2–5 menit, invalidate on mutation | Semua | ✅ Dashboard, POS, Inventori, Laporan, Keuangan, SO, PO, Buku Kas | Ya |
| P0-2 | **`neonGetDashboardBundle`** | Dashboard | ✅ | Ya — **3N → 1** |
| P0-3 | **Redis/Upstash** cache READ: bp, customers, categories, branches, suppliers | POS, Inventori, Pelanggan | ✅ | Ya |
| P0-4 | **Rate limit** login | Auth | ✅ `neonSignIn` only | Keamanan |

### P1 — Fase berikutnya (10–50 toko aktif)

| # | Item | Modul | Status |
|---|------|-------|--------|
| P1-1 | **`neonGetBranchProductsMulti`** | Inventori | ✅ |
| P1-2 | **`neonGetReportsBundle`** | Laporan | ✅ |
| P1-3 | **Prefetch route** sidebar hover | Navigasi | ✅ POS + Inventori |
| P1-4 | **IndexedDB warm** katalog POS | POS offline | ✅ |
| P1-5 | **Nav badges Neon** `counts` | Sidebar | ⚠️ SO ✅; pengiriman & order online = 0 (belum Neon) |
| P1-6 | Index `(tenant_id, branch_id)` branch_products | DB | ✅ applied production Neon |

### P2 — Saat 50–200 toko (data & laporan besar)

| # | Item | Catatan |
|---|------|---------|
| P2-1 | **Neon read replica** — laporan & dashboard baca dari replica | ✅ optional `DATABASE_URL_REPLICA` |
| P2-2 | **Tabel ringkasan harian** (`daily_branch_sales`) — job malam | ✅ |
| P2-3 | **PostgreSQL RLS** — defense in depth | ⚠️ template `phase8_rls.sql` |
| P2-4 | **Audit log** — void, ubah harga, hapus user | ⚠️ void sale ✅; price/user belum |
| P2-5 | **Connection pool tuning** | ❌ Fase D |

### P3 — Scale lanjutan (200+ toko)

| # | Item |
|---|------|
| P3-1 | Queue (BullMQ) — export Excel, sync offline |
| P3-2 | WebSocket notifikasi |
| P3-3 | CDN + edge cache asset |
| P3-4 | Observability — Sentry, Neon slow query |

---

## 4. Prioritas per modul (spesifik codebase)

### 4.1 Layout & Auth

| Prioritas | Tindakan | Status |
|-----------|----------|--------|
| P0 | Throttle auth sync | ✅ |
| P1 | Query `['tenant', slug]` staleTime 10 menit | ❌ |
| P2 | JWT refresh hanya saat 401 | ❌ |

---

### 4.2 Dashboard — **HOTSPOT #1** ✅

**Sebelum:** 3×N server fn (stats + 2× top products per cabang).

**Sesudah:** 1× `neonGetDashboardBundle` + `useQuery` staleTime 2 menit.

| Prioritas | Status |
|-----------|--------|
| P0-2 | ✅ |
| P0-1 useQuery | ✅ |

---

### 4.3 POS — checkout optimal ✅; cache ✅

| Prioritas | Status |
|-----------|--------|
| P0-3 Redis katalog + pelanggan | ✅ |
| P1-3 prefetch hover | ✅ POS, Inventori, Keuangan, SO, PO |
| P1-4 IndexedDB | ✅ |

---

### 4.4 Inventori — **HOTSPOT #2** ✅

**Sebelum:** 1 + N request (`getCategories` + N× `getBranchProducts`).

**Sesudah:** 2 request paralel (`getCategories` + `getBranchProductsMulti`) atau 1 round-trip bundle di server; `useQuery` + invalidasi on CRUD.

| Prioritas | Status |
|-----------|--------|
| P1-1 | ✅ |
| P0-3 | ✅ |
| P0-1 | ✅ |

---

### 4.5 Pelanggan & Supplier

| Prioritas | Status |
|-----------|--------|
| P0-3 customers + suppliers Redis | ✅ |
| P1 supplier cache client L1 | ✅ |

---

### 4.6 Laporan — **HOTSPOT #3** ✅ (core bundle)

**Sebelum:** 3×N server fn per load (`getDailySales` + `getTopProducts` + `getProfitLossSummary` per cabang).

**Sesudah:** 1× `neonGetReportsBundle` + `useQuery` staleTime **5 menit**.

| Prioritas | Status |
|-----------|--------|
| P1-2 | ✅ |
| P0-1 useQuery | ✅ |
| Cashier audit / opname variance (Neon) | ❌ masih kosong |

---

### 4.7 Keuangan — bundle + useQuery ✅

| Prioritas | Status |
|-----------|--------|
| P1 bundle saldo + transaksi + AR | ✅ `neonGetFinanceOverview` |
| P0-1 useQuery (Keuangan + Buku Kas) | ✅ |
| P2 materialized view | ❌ Fase D |

---

### 4.8 Pembelian, SO, Pengiriman

| Modul | Status |
|-------|--------|
| SO list | ✅ useQuery + prefetch |
| PO list | ✅ useQuery + prefetch |
| Nav badge SO (Neon) | ✅ `neonGetModuleNavCounts` |
| Pengiriman badge Neon | ✅ schema — write path checkout belum |
| Order online badge Neon | ✅ schema — portal Neon belum |

---

### 4.9 Notifikasi

Polling 5 menit — OK untuk &lt; 100 toko (P1).

---

## 5. Keamanan multi-tenant

| Prioritas | Item | Status |
|-----------|------|--------|
| P0 | `assertTenant` di server fn | Sebagian besar ✅ |
| P0 | Rate limit auth (login, PIN, register) | ✅ |
| P1 | Validasi `branch_id` ∈ `user_branches` | Perlu audit |
| P2 | Neon RLS | ⚠️ template `phase8_rls.sql` |
| P2 | Audit log | ⚠️ void sale ✅ |

---

## 6. Milestone skala

### Fase A — 1–10 toko, &lt; 100 user ✅ **selesai**
**Fokus:** P0-1 (partial), P0-2, P0-4  
**KPI:** dashboard 1 request ✅

### Fase B — 10–50 toko, 100–500 user ✅ **selesai**
**Fokus:** P0-3, P1-1, P1-2, P1-3, P1-4, P1-5 (SO), P0-1 hooks utama, P1-6 index  
**KPI:** Neon query repetitif turun — Upstash di Railway disarankan; index `idx_branch_products_tenant_branch` ✅ applied Neon

### Fase C — 50–200 toko ✅ **selesai (core)**
**Fokus:** P2-1 read replica, P2-2 daily aggregates, monitoring, rate limit, audit partial  
**KPI:** Laporan baca aggregate + SQL filter; `/health` expose cache & replica; nightly `npm run neon:rollup:daily`

### Fase D — 200+ toko ❌ belum
**Fokus:** P2-5 pool tuning, P3 queue/WebSocket, full RLS role, delivery/portal Neon write paths

---

## 7. Metrik yang harus dimonitor

| Metrik | Alat | Threshold waspada |
|--------|------|-------------------|
| p95 latency server fn | Railway / Sentry | > 1.5s |
| Neon active connections | Neon dashboard | > 80% pool |
| Slow queries (> 500ms) | Neon insights | naik mingguan |
| Request/user/menit | Custom middleware | > 30 sustained |
| Cache hit rate Redis | Upstash | < 50% setelah deploy |
| Error rate 5xx | Railway | > 0.5% |

---

## 8. Prinsip desain (jangan dilanggar)

1. **Write path (POS, stok, bayar)** — selalu DB primary, transaksi atomik, **no cache**
2. **Read path (master data)** — cache agresif, invalidate on write
3. **Laporan** — batch + pre-aggregate, bukan N query per widget
4. **Tenant isolation** — session adalah sumber kebenaran `tenant_id`
5. **80/20** — optimasi hotspot: Dashboard, POS, Inventori, Laporan

---

## 9. Backlog sprint

```
Sprint 1 ✅
  ├── P0-4 Rate limit login
  ├── P0-1 QueryClient + usePos + useDashboard
  └── P0-2 neonGetDashboardBundle

Sprint 2 ✅
  ├── P0-3 Redis + cache bp/customers/categories
  ├── P1-1 multi-branch products API
  └── Invalidate cache on POS checkout & product CRUD

Sprint 3 ✅
  ├── P1-2 neonGetReportsBundle + useReports useQuery
  ├── P1-3 Prefetch sidebar (POS, Inventori)
  └── P1-5 neonGetModuleNavCounts (SO; deliveries/online = 0)

Sprint 4 ✅
  ├── P1-4 IndexedDB warm POS (SWR via pos-catalog-warm)
  ├── P0-1 useFinance, useSalesOrders, usePurchaseOrders → useQuery
  ├── P0-3 cache branches + suppliers (server L2 + client L1)
  └── P1-6 index branch_products (tenant_id, branch_id)

Sprint 5 (Fase C) ✅
  ├── P2-2 daily_branch_sales + rollup job + reports pakai aggregate
  ├── P2-1 getReadDb() + DATABASE_URL_REPLICA
  ├── Reports SQL fix (top products, P&L filter di DB)
  ├── phase8 schema: deliveries, online_orders, audit_events
  ├── Nav badges Neon (deliveries + online_orders tables)
  ├── Health: cache hit rate, replica flag, aggregate row count
  ├── Rate limit: Redis async + PIN/register + bundle endpoints
  └── Audit log on void sale

Sprint 6 (Fase D — berikutnya)
  ├── POS checkout → insert deliveries Neon
  ├── Portal order online → insert online_orders Neon
  ├── Audit: ubah harga, hapus user
  ├── RLS dengan role terbatas + SET app.current_tenant_id
  └── P3 queue export / WebSocket notifikasi
```

---

## 10. Referensi file kunci

| Topik | Path |
|-------|------|
| QueryClient defaults | `src/lib/query-client.ts` |
| Query keys | `src/lib/query-keys.ts` |
| Server Redis cache | `src/server/cache/redis.ts` |
| Cache invalidation | `src/server/cache/invalidate.ts` |
| Rate limit | `src/server/rate-limit.ts` |
| Client cache | `src/lib/api/response-cache.ts` |
| Auth throttle | `src/lib/auth-sync-cache.ts` |
| Dashboard hook | `src/hooks/useDashboard.ts` |
| Reports bundle | `src/lib/api/reports.ts` → `getReportsBundle` |
| Reports server | `src/server/services/reports.ts` → `getReportsBundleReport` |
| Inventori hook | `src/hooks/useInventoryProducts.ts` |
| Prefetch sidebar | `src/lib/prefetch-module-queries.ts` |
| Nav badges | `src/hooks/useModuleNavBadges.ts`, `src/server/services/nav-counts.ts` |
| POS checkout | `src/stores/pos.store.ts` |
| POS IDB warm | `src/lib/offline/pos-catalog-warm.ts` |
| Finance bundle | `src/server/services/finance-overview.ts`, `neonGetFinanceOverview` |
| Finance / SO / PO / Buku Kas hooks | `useFinance.ts`, `useSalesOrders.ts`, `usePurchaseOrders.ts`, `useCashBook.ts` |
| Branches cache | `src/server/services/branches.ts` |
| Suppliers cache | `src/server/services/purchasing.ts`, `src/lib/api/purchasing.ts` |
| Index migration | `neon/phase2_index_branch_products_tenant_branch.sql` |
| Phase 8 schema | `neon/phase8_schema.sql` |
| Daily rollup | `scripts/rollup-daily-sales.mjs`, `npm run neon:rollup:daily` |
| Read replica | `getReadDb()`, `DATABASE_URL_REPLICA` |
| Audit log | `src/server/services/audit-log.ts` |
| Server fn rate limit | `src/server/server-fn-rate-limit.ts` |
| Neon server fns | `src/lib/api/neon/*.ts` |

---

## 11. Before / After ringkas (4 sprint)

| Layar | Before (Neon, 3 cabang) | After |
|-------|-------------------------|-------|
| Dashboard | 9 server fn | **1** `neonGetDashboardBundle` |
| Inventori konsolidasi | 4 server fn | **2** paralel (categories + multi-bp) atau 1 bundle |
| Laporan | 9 server fn | **1** `neonGetReportsBundle` |
| POS buka modul | 2 fn + repeat navigasi | **IDB instant** + cache L1+L2 + prefetch hover |
| Keuangan | N×3 fn per cabang | **1** `neonGetFinanceOverview` |
| Buku kas | N×2 fn per cabang | **1** bundle + useQuery |
| SO / PO | useEffect + repeat fetch | **useQuery** + dedupe catalog/suppliers |
| Branches / suppliers | setiap request DB | **Redis 300s / 120s** + invalidate on write |
| Login abuse | unlimited | **10 / 15 min / IP** |
| Sidebar badge SO | 0 (Neon) | **1 fn** poll 5 menit |
| Laporan daily sales | scan semua transaksi | **aggregate table** + live today |
| Top products / P&L | scan tenant + filter JS | **SQL filter** branch + date |
| Void transaksi | no audit | **audit_events** row |

---

*Terakhir diperbarui: Juli 2026 — Fase A–C selesai; production `seps.fazagroup.id`.*
