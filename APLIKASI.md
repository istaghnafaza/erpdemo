# SEPS — Penjelasan Aplikasi (Kondisi Saat Ini)

**Simetri ERP Store (SES)**  
Dokumen ini merangkum **goals, pengguna, fitur, alur bisnis, dan arsitektur** SEPS sesuai implementasi hingga **14 Agustus 2026**.

| | |
|---|---|
| **Produk** | SEPS — SaaS ERP untuk toko bangunan Indonesia |
| **Status** | Live (staging + production), pengembangan aktif |
| **Production** | https://seps.fazagroup.id |
| **Staging** | https://staging.seps.fazagroup.id |
| **Repo** | https://github.com/istaghnafaza/erpdemo.git |
| **Dokumen terkait** | [BRD.md](./BRD.md) · [PRD](./PRD_-_SES_Simetri_ERP_Store.md) · [DEPLOY.md](./DEPLOY.md) · [docs/PRICING.md](./docs/PRICING.md) |

---

## 1. Apa itu SEPS?

SEPS adalah **satu sistem operasional** untuk toko bangunan: kasir (POS), stok, pembelian, piutang/hutang, keuangan, laporan, dan portal order pelanggan — dalam model **SaaS multi-tenant** dan **multi-cabang**.

Setiap toko yang daftar = **satu tenant**. Data antar toko terisolasi. Owner bisa punya beberapa cabang, pegawai per peran, dan melihat kinerja per cabang atau konsolidasi.

**Satu kalimat:** mengganti buku, Excel, dan “feeling” owner dengan data stok, kas, piutang, dan laba yang terhubung dari kasir sampai laporan.

---

## 2. Goals

### 2.1 Tujuan bisnis (Simetri / Faza Group)

| ID | Goal | Ukuran keberhasilan |
|----|------|---------------------|
| G1 | Jadi sistem operasional harian toko bangunan | POS + inventory dipakai rutin, bukan hanya demo |
| G2 | Owner melihat laba, kas, piutang tanpa Excel | Dashboard + laporan P&L + aging |
| G3 | Onboarding cepat tanpa tutup toko | Transaksi pertama ≤ 1 hari; mode stok legacy |
| G4 | Skala SaaS banyak toko | Isolasi `tenant_id`; trial → bayar paket |
| G5 | Tim internal pantau adopsi | Platform dashboard: tenant, plan, HPP/harga |

### 2.2 Tujuan operasional (per toko)

- Stok akurat lewat GRN, transfer, dan opname.
- Setiap shift kasir tercatat (omzet, metode bayar, selisih).
- Piutang kontraktor dan hutang supplier ter-aging.
- Laporan penjualan & laba rugi per cabang + konsolidasi owner.

### 2.3 Masalah yang ditutup

| Masalah toko bangunan | Jawaban SEPS |
|-----------------------|--------------|
| Stok tidak akurat | Stok per cabang, opname, transfer, pergerakan |
| Cash flow tidak terlihat | Buku kas, dashboard, P&L |
| Piutang kontraktor macet | Tempo di POS, aging, pelunasan |
| Sulit audit kasir | Shift, histori, laporan audit kasir |
| Harga/HPP kacau | Master barang, satuan jual, aturan harga |
| Laporan lambat | Dashboard + laporan penjualan / P&L |
| Barang fast-moving kosong | Notifikasi stok kritis, reorder point |

---

## 3. Siapa penggunanya

### 3.1 Di dalam toko (RBAC)

| Peran | Fokus | Modul utama |
|-------|--------|-------------|
| **Owner** | Semua cabang, laba, pegawai, paket | Dashboard, Toko Saya, Users, Laporan, Keuangan |
| **Manager** | Operasional cabang | POS, stok, SO, pembelian, laporan (kecuali P&L penuh = owner/akuntan) |
| **Kasir** | Penjualan harian | POS, histori, retur, pengiriman, order online |
| **Gudang** | Stok & penerimaan | Inventory, SO, pembelian, GRN, opname, transfer |
| **Akuntan** | Kas & kewajiban | Keuangan, piutang, hutang, P&L, laporan |

Akses diatur di `src/lib/rbac.ts`. Owner selalu bisa semua.

### 3.2 Di luar toko

| Peran | Apa yang dilakukan |
|-------|-------------------|
| **Platform admin** (tim SEPS) | Katalog master, tenant, harga paket, tandai lunas manual |
| **Pelanggan toko** | Portal `/{slug}/shop` — browse, keranjang, order (jika diaktifkan) |

---

## 4. Model bisnis & paket

Trial **7 hari** (limit setara Pro: 2 cabang, 15 user), lalu upgrade self-service.

| Paket | Cabang | User | Harga bulanan* | Harga tahunan (setara /bln)* |
|-------|--------|------|----------------|------------------------------|
| Trial | 2 | 15 | Rp 0 (7 hari) | — |
| Basic | 1 | 5 | Rp 599.000 | Rp 499.000 |
| Pro | 2 | 15 | Rp 849.000 | Rp 749.000 |
| Enterprise | praktis tanpa batas | praktis tanpa batas | Rp 2.499.000 | Rp 1.999.000 |

\*Harga default di kode; platform admin bisa mengubah harga remote (dipakai landing, `/pricing`, dan checkout). Belum termasuk PPN.

**Cara bayar paket (saat ini):** Midtrans Snap (QRIS / VA / e-wallet).  
Webhook `POST /api/midtrans/notification` mengaktifkan plan. Platform admin bisa **tandai lunas manual**.

- **Sandbox** = uji coba (VA/QRIS tidak valid di bank sungguhan).
- **Production** = uang sungguhan, setelah akun Midtrans lolos review bisnis.

Detail harga: [docs/PRICING.md](./docs/PRICING.md).

---

## 5. Peta modul (runtut operasional)

Alur bisnis toko dari daftar sampai tutup buku:

```
Daftar / login
    → Onboarding toko & cabang
        → Master barang & kategori
            → POS / Sales Order / Portal
                → Pengiriman & retur
                    → Pembelian & GRN (stok masuk)
                        → Piutang / hutang
                            → Buku kas & P&L
                                → Laporan & audit
```

### 5.1 Masuk sistem

| Fitur | Keterangan |
|-------|------------|
| Registrasi owner | `/register` — toko baru + trial |
| Login | Username (case-sensitive) + PIN/password |
| Google OAuth | Opsional, callback `/auth/google/callback` |
| Landing & pricing | `/` (landing), `/pricing` |
| Guard | Route per `/{tenantSlug}/...`; sesi cookie |

### 5.2 Onboarding & Toko Saya

- Wizard setup toko (bisa bertahap, tidak wajib tutup toko).
- Mode **stok legacy**: operasional jalan dulu, stok diselaraskan belakangan (opname).
- **Toko Saya** (owner): profil toko, cabang, pengaturan pembayaran cabang.
- Limit cabang/user mengikuti paket; banner upgrade jika trial habis / hampir jatuh tempo.

### 5.3 Dashboard

KPI harian: penjualan, laba/margin, saldo kas, stok kritis, piutang.  
Owner: konsolidasi multi-cabang. Manager: cabang aktif.

### 5.4 POS Kasir

Modul inti penjualan ritel.

- Katalog cabang aktif; **filter kategori hanya yang punya barang** di inventory cabang itu.
- Multi-keranjang, satuan jual alternatif (curah / dus / pcs).
- Metode: tunai, transfer, kartu, QRIS, tempo (piutang).
- Shift kasir buka/tutup; hold cart; PWA + cache katalog untuk offline.
- Pelanggan + alamat kirim berulang (site proyek kontraktor).

### 5.5 Histori penjualan, retur, pengiriman

- Histori transaksi per cabang.
- **Retur barang** — kasir/gudang/manager/owner.
- **Pengiriman** — status kirim dari SO / POS.

### 5.6 Inventory

| Submodul | Fungsi |
|----------|--------|
| Master Barang | SKU, nama pintar (atribut), HPP, harga jual, satuan, barcode |
| Import massal | Excel/CSV; &lt;10 item input manual, ≥10 pakai template + sheet Data Legacy |
| Stock opname | Setup → hitung → review selisih; sinkron dari DB |
| Transfer stok | Antar cabang: draft → kirim → terima |
| Kategori POS | Mengikuti barang yang benar-benar ada di cabang, bukan daftar master kosong |

### 5.7 Master data katalog (platform → toko)

Developer di `/platform/catalog` mengedit **kategori, jenis barang, atribut** (standar penamaan & SKU).

**Terbitkan Master Data** melakukan dua hal:

1. Simpan versi katalog platform (JSONB).
2. **Sync kategori ke `product_categories` semua toko aktif** (rename alias, pindahkan produk jika perlu).

Toko melihat katalog **read-only**; usulan kategori/jenis baru lewat **permintaan katalog**.

### 5.8 Pelanggan

Master pelanggan, segmen (umum, kontraktor, dll.), limit kredit, site pengiriman.

### 5.9 Sales order

Pesanan gudang/kontraktor: split fulfillment, status, terhubung pengiriman.

### 5.10 Pembelian

- Supplier  
- Purchase order  
- Goods receipt (GRN) → stok naik, hutang supplier  

### 5.11 Keuangan

- Dashboard keuangan & **buku kas** per cabang/akun.
- POS tunai masuk kas kasir; transfer/QRIS ke rekening.
- HPP tercatat di P&L tanpa mengurangi kas.
- Piutang (receivables) + pelunasan.  
- Hutang (payables) dari pembelian.

### 5.12 Laporan

- Ringkasan laporan  
- Penjualan  
- Laba rugi (owner / akuntan)  
- Audit kasir  
- Laporan selisih stock opname  

### 5.13 Pegawai (Users)

Owner menambah user, peran, cabang, PIN. Terbatas kuota paket.

### 5.14 Pengaturan toko

- Master data (atribut produk — read-only dari platform)  
- Aturan harga (pricing tiers)  
- Pengaturan umum / pembayaran cabang  

### 5.15 Portal pelanggan (`/{slug}/shop`)

Katalog publik, keranjang, checkout, riwayat order.  
Staff melihat antrian di **Order Online**. Bisa di-flag fitur.

### 5.16 Platform admin (`/platform/...`)

| Halaman | Fungsi |
|---------|--------|
| Dashboard | Tenant, plan, tandai invoice Midtrans lunas manual |
| Katalog | Master kategori/jenis/atribut + terbitkan |
| Keuangan platform | Daftar HPP, harga paket remote |

---

## 6. Billing langganan (Midtrans)

```
Owner pilih paket di app /pricing
    → server buat Snap transaction (order_id unik)
        → popup Snap (QRIS / VA / e-wallet)
            → pelanggan bayar
                → Midtrans POST /api/midtrans/notification
                    → invoice paid → tenant.plan aktif + periode perpanjang
```

Env yang dipakai:

```
MIDTRANS_SERVER_KEY
MIDTRANS_CLIENT_KEY
MIDTRANS_IS_PRODUCTION=true|false
MIDTRANS_NOTIFICATION_URL=https://<host>/api/midtrans/notification
```

Staging uji coba memakai **Sandbox**. Production menunggu review bisnis Midtrans + channel pembayaran aktif.

---

## 7. Arsitektur teknis (ringkas)

| Layer | Teknologi |
|-------|-----------|
| App | TanStack Start (SSR) + TanStack Router (file-based) |
| UI | React 19, TypeScript, Tailwind v4, shadcn/ui |
| State | Zustand; React Query untuk data server |
| DB | Neon PostgreSQL + Drizzle ORM |
| Cache | Upstash Redis (opsional, katalog/kategori) |
| Auth | Session cookie + AUTH_SECRET; Google OAuth opsional |
| Deploy | Railway (Docker); GitHub `staging` → staging, `main` → production |
| PWA | Service worker untuk POS offline |

**Aturan kode yang dipertahankan:**

1. Query DB / API hanya lewat `src/lib/api/` + server services.  
2. Setiap data toko wajib `tenant_id`.  
3. Logic di `src/hooks/`, UI di `src/components/`.  
4. TypeScript ketat; tipe di `src/types/`.

**Lingkungan:**

| Env | URL | Branch Git | Database |
|-----|-----|------------|----------|
| Lokal | http://localhost:8081 | feature / staging | `.env` → Neon |
| Staging | https://staging.seps.fazagroup.id | `staging` | Neon branch staging |
| Production | https://seps.fazagroup.id | `main` | Neon main |

---

## 8. Navigasi aplikasi toko

URL pola: `/{tenantSlug}/...`

| Menu | Path |
|------|------|
| Dashboard | `/dashboard` |
| POS Kasir | `/pos` |
| Histori Penjualan | `/sales/transactions` |
| Retur Barang | `/sales/returns` |
| Pengiriman | `/deliveries` |
| Inventory | `/inventory`, `/inventory/products`, `/stock-opname`, `/stock-transfer` |
| Pelanggan | `/customers` |
| Sales Order | `/sales-orders` |
| Pembelian | `/purchasing`, PO, GRN, supplier |
| Keuangan | `/finance`, `/finance/cash-book` |
| Piutang / Hutang | `/receivables`, `/payables` |
| Laporan | `/reports/...` |
| Users | `/users` |
| Pengaturan | `/settings/...` |
| Toko Saya | `/toko-saya` |
| Order Online | `/online-orders` |
| Portal publik | `/shop` |

---

## 9. Status implementasi vs yang belum

### Sudah jalan (inti MVP + post-MVP)

- Multi-tenant, multi-cabang, RBAC  
- POS, inventory, SO, purchasing, finance, piutang/hutang, laporan  
- Onboarding, PWA POS, Google login  
- Landing, pricing, trial 7 hari  
- Checkout paket Midtrans Snap + webhook  
- Platform: katalog, tenant, harga remote  
- Import master barang, sync opname, sync kategori saat terbitkan katalog  
- Retur, pengiriman, portal shop, aturan harga  

### Belum / terbatas

| Item | Catatan |
|------|---------|
| Midtrans Production channel | Akun masih review; staging pakai Sandbox |
| Integrasi Accurate/Jurnal | Belum |
| Payroll/HR penuh | Hanya user operasional |
| Kurir pihak ketiga | Pengiriman dicatat internal |
| Domain portal unik per toko | Masih `/{slug}/shop` |

BRD lama sempat menandai payment gateway “out of scope”; **itu sudah diimplementasi (Midtrans)**. Pakai dokumen ini untuk status terkini.

---

## 10. Cara kerja harian (contoh)

**Kasir pagi:** buka shift → POS → pilih barang (kategori yang ada stok) → bayar tunai/QRIS/tempo → tutup shift.

**Gudang:** terima PO (GRN) → stok naik → transfer ke cabang lain bila perlu → opname berkala.

**Owner malam:** dashboard omzet & laba → cek piutang kontraktor → laporan P&L → jika trial hampir habis, upgrade via Midtrans.

**Developer SEPS:** ubah kategori di platform → Terbitkan Master Data → kategori toko ikut terselaraskan.

---

## 11. Menjalankan lokal (untuk pengembang)

```bash
npm install
cp .env.example .env    # DATABASE_URL, AUTH_SECRET, Midtrans, dll.
npm run neon:setup      # skema + seed (sekali)
npm run dev             # http://localhost:8081
```

Deploy: push ke `staging` atau `main` → Railway. Lihat [DEPLOY.md](./DEPLOY.md) dan [docs/WORKFLOW_GIT.md](./docs/WORKFLOW_GIT.md).

---

*Dokumen ini adalah snapshot produk, bukan kontrak harga. Harga live mengikuti platform finance + [docs/PRICING.md](./docs/PRICING.md).*
