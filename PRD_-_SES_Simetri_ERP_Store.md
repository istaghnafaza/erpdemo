# PRD: SES (Simetri ERP Store) — ERP Terintegrasi untuk Toko Bangunan Multi-Cabang & Multi-Tenant

**Project:** SES - Simetri ERP Store
**Aesthetic:** Enterprise-grade, clean, trustworthy, data-driven — dark & light mode support

---

## Latar Belakang & Problem Statement

Toko bangunan skala menengah menghadapi berbagai masalah operasional yang menghambat pertumbuhan bisnis:

| # | Masalah | Dampak |
|---|---------|--------|
| 1 | Stok tidak akurat | Salah kirim, kekurangan/kelebihan barang |
| 2 | Tidak bisa mengetahui cash flow | Keputusan keuangan buta |
| 3 | Sulit mengontrol piutang pelanggan | Bad debt tidak terkendali |
| 4 | Sulit audit karyawan | Fraud & produktivitas rendah tak terdeteksi |
| 5 | Sulit mengetahui barang hilang/rusak/dicuri | Kerugian tersembunyi |
| 6 | Sulit mengetahui laba sebenarnya | Tidak tahu bisnis untung atau rugi |
| 7 | Harga jual sering salah karena tidak update | Margin tergerus, customer komplain |
| 8 | Sulit mengetahui barang terlaris | Stok tidak sesuai permintaan pasar |
| 9 | Sering kehabisan barang fast-moving | Kehilangan penjualan |
| 10 | Sulit mengontrol hutang supplier | Cash flow terganggu, reputasi buruk |
| 11 | Pembuatan laporan sangat lama | Keputusan terlambat |
| 12 | Pengambilan keputusan berdasarkan perasaan | Risiko bisnis tinggi |

**SES hadir sebagai solusi ERP terintegrasi** yang menghubungkan seluruh aspek operasional toko bangunan dalam satu platform — mendukung operasional **multi-cabang** per toko, dan dibangun sebagai **platform SaaS multi-tenant** yang bisa digunakan oleh banyak toko bangunan berbeda pemilik dalam satu sistem.

---

## Arsitektur SaaS Multi-Tenant

### Model Tenant

Setiap toko bangunan yang mendaftar ke SES adalah satu **Tenant** yang sepenuhnya terisolasi dari tenant lain. Semua data (produk, stok, transaksi, keuangan, user) dipartisi per `tenantId` di level aplikasi.

```
SES Platform
├── Tenant: Toko Bangunan Simetri (tenantId: "ten-001")
│   ├── Cabang Sudirman
│   ├── Cabang Kebon Jeruk
│   └── Cabang Bekasi
├── Tenant: Toko Maju Jaya (tenantId: "ten-002")
│   └── Cabang Utama
└── Tenant: UD Berkah Makmur (tenantId: "ten-003")
    ├── Cabang A
    └── Cabang B
```

**Keputusan arsitektur data: Shared Database, Tenant-Isolated**

| Aspek | Keputusan | Alasan |
|-------|-----------|--------|
| Database | **Satu database, partisi per tenantId** | Lebih murah, mudah maintain untuk skala awal-menengah |
| Isolasi data | **tenantId wajib di semua query** | Tidak ada data bocor antar tenant |
| Library produk | **Shared (opsional)** | Katalog produk toko bangunan umum bisa dishare untuk percepat onboarding |
| Upgrade/patch | **Semua tenant dapat update bersamaan** | Efisiensi maintenance, tidak perlu update per toko |

### Hirarki Akses SaaS

```
👑 SES Super Admin (internal Simetri)
 └── Kelola semua tenant
 └── Lihat health metrics per tenant
 └── Onboarding & support

🏪 Tenant Owner (pemilik toko)
 └── Kelola semua cabang miliknya
 └── Tidak bisa lihat data tenant lain

👔 Manajer, Kasir, dst.
 └── Sesuai RBAC yang sudah ada
```

---

## Arsitektur Multi-Cabang

### Keputusan Desain

SES menggunakan model **"Stok Per Cabang Independen + Transfer Stok Antar Cabang"**. Ini adalah pendekatan yang paling umum dan paling sesuai untuk kebutuhan toko bangunan dengan beberapa outlet:

| Aspek | Keputusan | Alasan |
|-------|-----------|--------|
| Master Produk | **Terpusat (shared)** | SKU, nama, satuan, dan kategori berlaku untuk semua cabang |
| Harga Jual | **Per cabang (bisa berbeda)** | Tiap cabang bisa punya harga sesuai pasar lokalnya |
| Harga Beli (HPP) | **Terpusat (owner set)** | Konsistensi margin; cabang tidak bisa edit HPP |
| Stok | **Per cabang (independen)** | Stok cabang A dan B dihitung terpisah |
| Transfer Stok | **Ada, via dokumen Transfer** | Jika cabang A kekurangan, bisa minta kirim dari cabang B |
| Penjualan Indent | **Via Sales Order (SO)** | Pesanan besar yang sebagian/seluruhnya dipenuhi langsung dari supplier ke klien — tanpa mengurangi stok toko |
| Laporan | **Per cabang + konsolidasi** | Manager lihat cabangnya; owner lihat semua + gabungan |
| Pelanggan & Piutang | **Terpusat** | Pelanggan yang sama bisa belanja di cabang mana pun |
| Supplier & Hutang | **Terpusat** | PO bisa dilakukan oleh cabang mana pun ke supplier yang sama |
| Kas & Bank | **Per cabang** | Kas fisik tiap cabang dikelola terpisah |

### Hierarki Akses

```
👑 Owner
 └── Lihat & kelola SEMUA cabang
 └── Laporan konsolidasi lintas cabang
 └── Set harga beli (HPP) terpusat
 └── Buat & nonaktifkan cabang

👔 Manajer (ditugaskan ke 1 atau lebih cabang)
 └── Hanya bisa akses cabang yang ditugaskan
 └── Switch antar cabang via Branch Switcher
 └── Laporan per cabang yang dikelola

🏷️ Kasir / Gudang / Akuntan (ditugaskan ke 1 cabang)
 └── Hanya bisa akses cabang tempat bertugas
 └── Tidak bisa switch cabang
```

### Branch Switcher UI (untuk Owner & Manajer Multi-Cabang)

Komponen selector cabang aktif yang tampil di top navigation, di sebelah logo:

```
┌─────────────────────────────────────────────────────────────────────┐
│ [SES Logo]  📍 Cabang Sudirman ▼   [🏠] [🛒] [📦] [💰] ...        │
│             ┌──────────────────────────────┐                         │
│             │ 🔍 Cari cabang...            │                         │
│             │ ──────────────────────────── │                         │
│             │ ✅ Cabang Sudirman (aktif)   │                         │
│             │    Cabang Kebon Jeruk        │                         │
│             │    Cabang Bekasi             │                         │
│             │ ──────────────────────────── │                         │
│             │ 📊 Semua Cabang (konsolidasi)│  ← hanya Owner          │
│             └──────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

- Semua data yang ditampilkan (stok, transaksi, kas, laporan) otomatis terfilter sesuai cabang aktif
- Saat owner pilih **"Semua Cabang"** → dashboard & laporan tampil dalam mode konsolidasi
- Perpindahan cabang tidak perlu logout; cukup klik Branch Switcher
- Cabang aktif saat ini selalu terlihat di top bar (persistent)

### Modul Transfer Stok Antar Cabang

Fitur khusus untuk memindahkan stok dari satu cabang ke cabang lain secara terdokumentasi:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🔄 Transfer Stok Antar Cabang                    TRSF-2025-01-001      │
│ ──────────────────────────────────────────────────────────────────────  │
│ Dari Cabang: [Cabang Sudirman        ▼]                                 │
│ Ke Cabang:   [Cabang Kebon Jeruk     ▼]                                 │
│ Tgl Kirim:   [15/01/2025]   Estimasi Tiba: [16/01/2025]                 │
│ ────────────────────────────────────────────────────────────────────── │
│  #   SKU      Nama Barang         Stok Asal  Qty Kirim  Stok Sisa      │
│  1   BRG-001  Semen Portland 50kg    80          30        50           │
│  2   BRG-004  Pipa PVC 3/4"          45          20        25           │
│  [+ Tambah Item]                                                        │
│ ────────────────────────────────────────────────────────────────────── │
│  Catatan: [Pengiriman darurat untuk proyek Pak Budi]                    │
│  [Simpan Draft]   [Kirim & Kurangi Stok Asal]                           │
└────────────────────────────────────────────────────────────────────────┘
```

**Alur Transfer Stok:**
```
Buat Dokumen Transfer (cabang asal)
→ Stok cabang asal BERKURANG (status: "Dalam Pengiriman")
→ Cabang tujuan terima notifikasi
→ Konfirmasi Penerimaan oleh gudang cabang tujuan
→ Stok cabang tujuan BERTAMBAH (status: "Diterima")
→ Transfer selesai, dokumen tercatat di kedua cabang
```

**Status Transfer:**
- 🟡 `Draft` — belum dikirim
- 🔵 `Dikirim` — stok asal sudah dikurangi, menunggu konfirmasi
- 🟢 `Diterima` — stok tujuan sudah bertambah, selesai
- 🔴 `Dibatalkan` — stok asal dikembalikan

---

## Modul Onboarding Tenant

Modul khusus untuk proses registrasi dan setup awal toko baru. Dirancang agar toko bisa **go-live tanpa perlu tutup** — transaksi bisa dimulai bahkan sebelum data stok sempurna.

### Filosofi Onboarding SES

```
Yang WAJIB ada sebelum transaksi pertama:
  ✅ Produk terdaftar (nama + harga jual + satuan)
  ✅ Minimal 1 user kasir aktif
  ✅ Minimal 1 cabang terdaftar

Yang BOLEH menyusul:
  ⏳ Stok akurat → bisa pakai legacyStock dulu
  ⏳ Harga beli (HPP) → bisa diisi belakangan
  ⏳ Data hutang/piutang lama → input manual menyusul
  ⏳ Barcode semua produk → stok lama tanpa barcode dulu
```

### 4 Jalur Onboarding

Saat setup awal, sistem menanyakan kondisi toko:

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏪 Selamat Datang di SES!                                          │
│  Ceritakan kondisi toko kamu agar kami bisa bantu setup dengan      │
│  cara yang paling sesuai.                                           │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ○  🆕 Toko baru, belum pernah buka                                 │
│     Mulai dari nol — kami pandu langkah demi langkah               │
│                                                                     │
│  ○  📦 Toko lama, tidak ada catatan stok                            │
│     Pakai sistem stok lama — toko tetap buka selama setup           │
│                                                                     │
│  ○  📒 Toko lama, stok dicatat di buku/manual                       │
│     Input bertahap sambil toko buka, prioritaskan fast-moving       │
│                                                                     │
│  ○  📊 Toko lama, punya file Excel                                  │
│     Import langsung — paling cepat, 2-4 jam selesai                │
│                                                                     │
│  [Lanjut →]                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### Jalur A — Toko Baru (Mulai dari Nol)

Flow paling simpel. 5 langkah guided:

```
[1. Info Toko] → [2. Buat Cabang] → [3. Tambah User] → [4. Tambah Produk] → [5. Go Live!]
```

Di langkah 4, tersedia **Library Produk Toko Bangunan** — katalog produk umum yang sudah dikurasi SES (semen, bata, cat, pipa, keramik, besi, dll). Pemilik tinggal centang produk yang dijual, isi harga jual, langsung siap.

```
┌─────────────────────────────────────────────────────────────────────┐
│  📚 Library Produk Toko Bangunan                                    │
│  Pilih produk yang kamu jual, sesuaikan harga                       │
│  🔍 Cari produk...                                                  │
│  ─────────────────────────────────────────────────────────────────  │
│  ☑  Semen Portland 50kg     Harga jual: [Rp 65.000  ]  Sat: Sak    │
│  ☑  Bata Merah              Harga jual: [Rp 1.100   ]  Sat: Pcs    │
│  ☐  Cat Tembok 5kg          Harga jual: [Rp 45.000  ]  Sat: Kaleng │
│  ☑  Pipa PVC 3/4"           Harga jual: [Rp 22.000  ]  Sat: Btg    │
│  ☑  Keramik 40x40           Harga jual: [Rp 78.000  ]  Sat: Dus    │
│  ... (200+ produk tersedia)                                         │
│  ─────────────────────────────────────────────────────────────────  │
│  47 produk dipilih          [+ Tambah Produk Custom]  [Import →]   │
└─────────────────────────────────────────────────────────────────────┘
```

Stok awal = 0. Toko langsung bisa transaksi.

---

#### Jalur B — Toko Lama, Tidak Ada Catatan

Stok tidak diketahui. Gunakan mekanisme **Legacy Stock**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  📦 Mode Legacy Stock                                               │
│  ─────────────────────────────────────────────────────────────────  │
│  Karena stok lama belum tercatat, SES akan:                         │
│                                                                     │
│  ✅ Mengizinkan transaksi meski stok = 0 (selama masa transisi)     │
│  ✅ Menandai setiap penjualan sebagai "Stok Lama" otomatis          │
│  ✅ Stok akan terbentuk akurat sendiri seiring barang baru masuk    │
│                                                                     │
│  Yang perlu kamu lakukan sekarang:                                  │
│  → Daftarkan produk yang kamu jual (nama + harga saja)             │
│  → Isi perkiraan stok awal jika bisa (boleh dikosongkan)           │
│  → Tempel barcode di barang BARU yang datang dari supplier          │
│  → Barang lama: kasir pilih manual saat transaksi                  │
│                                                                     │
│  [Mulai Daftarkan Produk →]                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### Jalur C — Toko Lama, Catatan di Buku

Input bertahap, diprioritaskan per kategori. SES menyediakan **form input cepat massal**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  📒 Input Produk dari Buku Catatan                                  │
│  Kerjakan sambil toko buka — mulai dari produk terlaris dulu        │
│  ─────────────────────────────────────────────────────────────────  │
│  Kategori: [Semen ▼]                                                │
│                                                                     │
│  Nama Produk           Harga Jual   Stok Awal   Satuan             │
│  [Semen Portland 50kg] [65.000    ] [80       ] [Sak    ▼]  [+ ✓] │
│  [Semen Putih 40kg   ] [55.000    ] [20       ] [Sak    ▼]  [+ ✓] │
│  [__________________ ] [__________] [__________] [_______ ▼]       │
│                                                                     │
│  Progress: 47/200 produk selesai  ████████░░░░░░  24%              │
│                                                                     │
│  💡 Tip: Kerjakan kategori Semen & Bata dulu                        │
│     karena biasanya paling sering terjual.                          │
│                                                                     │
│  [Simpan & Lanjut Nanti]    [Tandai Kategori Ini Selesai ✓]        │
└─────────────────────────────────────────────────────────────────────┘
```

Produk yang belum diinput masuk ke "backlog onboarding" — bisa dikerjakan kapan saja, tidak menghalangi toko beroperasi.

---

#### Jalur D — Toko Lama, Punya Excel

Import langsung. Paling cepat:

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 Import dari Excel                                               │
│  ─────────────────────────────────────────────────────────────────  │
│  Langkah 1: Download template                                       │
│  [⬇ Download Template Excel SES]                                    │
│                                                                     │
│  Template berisi kolom:                                             │
│  SKU* | Nama Produk* | Kategori | Harga Beli | Harga Jual* |       │
│  Stok Awal | Satuan* | Barcode | Lokasi Gudang | Reorder Point     │
│  (* = wajib diisi)                                                  │
│                                                                     │
│  Langkah 2: Isi template, lalu upload                               │
│  [📂 Upload File Excel]                                             │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  ✅ 312 produk siap diimport                                         │
│  ⚠️  8 baris error — klik untuk lihat detail:                        │
│     Baris 15: Satuan tidak dikenal "box" → ganti ke "dus"           │
│     Baris 47: Harga jual kosong (wajib diisi)                       │
│     Baris 88: SKU duplikat dengan baris 23                          │
│     ... 5 error lainnya                                             │
│                                                                     │
│  [Perbaiki Error]    [Import 312 Produk yang Valid →]               │
└─────────────────────────────────────────────────────────────────────┘
```

Error ditampilkan per baris dengan pesan yang jelas. Produk yang valid bisa langsung diimport tanpa menunggu semua error diperbaiki.

---

### Mekanisme Legacy Stock

Inti dari "go-live tanpa tutup toko" — memungkinkan toko beroperasi meski stok belum 100% akurat.

**Cara kerja di level data:**

`BranchProduct` punya dua counter stok terpisah:
- `stock` — stok yang sudah terverifikasi (dari penerimaan barang berbarcode)
- `legacyStock` — stok lama yang diinput manual saat onboarding, belum terverifikasi

**Cara kerja di POS:**

```
Kasir scan barcode ada → kurangi `stock`
Kasir pilih produk manual (stok lama) → kurangi `legacyStock`
                                       → tandai transaksi: source: 'legacy'

Jika kedua stok habis (stock=0, legacyStock=0):
→ SES tetap izinkan transaksi selama masa onboarding aktif
→ Tampil warning kuning: "⚠️ Stok tidak terverifikasi"
→ Transaksi tercatat dengan flag `stockUnverified: true`
```

**Kapan masa onboarding berakhir:**
- Owner klik "Selesaikan Onboarding" secara manual, ATAU
- Semua produk sudah pernah diupdate stoknya minimal sekali
- Setelah selesai → stok negatif tidak lagi diizinkan

**Di laporan**, transaksi stok lama ditandai khusus agar owner bisa track seberapa banyak penjualan dari stok yang belum terverifikasi.

---

### Onboarding Progress Tracker

Dashboard kecil yang muncul di sidebar sampai onboarding selesai:

```
┌──────────────────────────────────────┐
│  🚀 Setup Toko — 68% selesai         │
│  ████████████████░░░░░░░░            │
│                                      │
│  ✅ Info toko & cabang               │
│  ✅ User & role                      │
│  ✅ 312 produk diimport              │
│  ⏳ Stok awal (247/312 produk)       │
│  ⏳ Harga beli (HPP) — opsional      │
│  ⏳ Data hutang lama — opsional      │
│                                      │
│  Toko sudah bisa transaksi! 🎉       │
│  [Lanjutkan Setup]  [Tutup]          │
└──────────────────────────────────────┘
```

---

## Core Layout: Modular ERP

### Struktur Global

```
┌─────────────────────────────────────────────────────────────────────┐
│ [SES Logo]  📍 Cabang Sudirman ▼                                    │
│ [🏠 Dashboard] [🛒 POS] [📦 Inventory] [💰 Keuangan]               │
│ [📋 Hutang/Piutang] [🛍️ Pembelian] [📊 Laporan]                    │
│                                        [🔔 Notifikasi] [👤 Profil]  │
└─────────────────────────────────────────────────────────────────────┘
```

### 1. Global Navigation (Top Bar)
- Logo SES + **Branch Switcher** (dropdown pilih cabang aktif)
- Module switcher horizontal: Dashboard, POS, Inventory, Keuangan, Hutang/Piutang, Pembelian, Laporan
- Global search (⌘K): cari produk, pelanggan, supplier, transaksi — **dalam scope cabang aktif**
- Notifikasi (badge): stok menipis, piutang jatuh tempo, hutang jatuh tempo — **per cabang aktif**
- User profile: nama, role, cabang yang ditugaskan, avatar, logout

### 2. Module-Specific Left Sidebar (20%)
- Sub-navigasi kontekstual per modul
- Quick actions: tombol aksi utama yang paling sering digunakan
- Shortcut ke laporan terkait modul

### 3. Main Content Area (55%)
- Dashboard modul atau view yang dipilih
- Data table dengan sorting, filtering, pencarian
- Form input (tambah/edit data)
- Detail view per entitas

### 4. Context / Summary Panel (Right - 25%)
- Ringkasan data kontekstual berdasarkan item yang dipilih
- Referensi cross-modul (contoh: pelanggan → lihat piutang + riwayat transaksi POS)
- Quick actions per item

---

## Modul-Modul SES

### Modul 1: Dashboard (Beranda Utama)

Halaman pertama setelah login. Memberikan ringkasan seluruh kondisi bisnis dalam satu layar.

**Dashboard memiliki dua mode tampilan:**

**Mode Cabang Tunggal** (saat satu cabang dipilih di Branch Switcher):
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 💰 Penjualan │ │ 📦 Stok Kritis│ │ 📄 Piutang   │ │ 🧾 Hutang    │
│ Hari ini     │ │ 8 item       │ │ Jatuh Tempo  │ │ Jatuh Tempo  │
│ Rp 4.500.000 │ │ perlu reorder│ │ Rp 12.400.000│ │ Rp 7.800.000 │
│ +12% vs kmrn │ │ [Lihat →]   │ │ 5 pelanggan  │ │ 3 supplier   │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**Mode Konsolidasi** (Owner pilih "Semua Cabang" di Branch Switcher):
```
┌──────────────────────────────────────────────────────────────────────┐
│ 📊 Dashboard Konsolidasi — Semua Cabang        Periode: [Bulan Ini ▼]│
│ ──────────────────────────────────────────────────────────────────── │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Total Revenue│ │ Stok Kritis  │ │ Total Piutang│ │ Total Hutang │ │
│ │ Semua Cabang │ │ (semua cbng) │ │ Semua Cabang │ │ Semua Cabang │ │
│ │ Rp 12.800.000│ │ 21 item      │ │ Rp 87.400.000│ │ Rp 33.500.000│ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │
│                                                                      │
│ Perbandingan Penjualan Per Cabang                                    │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │  Sudirman    ████████████████████  Rp 4.500.000                  │ │
│ │  Kebon Jeruk ██████████████        Rp 3.200.000                  │ │
│ │  Bekasi      ███████████████████   Rp 5.100.000                  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ Ringkasan Per Cabang                                                 │
│ Cabang        Revenue      Transaksi  Stok Kritis  Piutang Aktif    │
│ Sudirman      Rp 4.500.000    47         8          Rp 12.000.000   │
│ Kebon Jeruk   Rp 3.200.000    31         5          Rp 45.000.000   │
│ Bekasi        Rp 5.100.000    58         8          Rp 30.400.000   │
└──────────────────────────────────────────────────────────────────────┘
```

**Grafik & Analitik:**
- Grafik penjualan 7/30 hari terakhir — per cabang atau konsolidasi (line chart)
- Top 5 barang terlaris bulan ini (horizontal bar chart)
- Cash flow masuk vs keluar (area chart)
- Komposisi piutang berdasarkan aging (pie chart)
- **[Mode Konsolidasi only]** Tabel perbandingan KPI antar cabang (klik baris → drill down ke cabang)

**Notifikasi Aktif:**
- 🔴 Stok menipis: [nama barang] tersisa [X] unit — 📍 [nama cabang]
- 🔵 Transfer stok masuk menunggu konfirmasi — 📍 [cabang tujuan]
- 🟡 Piutang jatuh tempo: [nama pelanggan] - Rp [X]
- 🟡 Hutang supplier jatuh tempo: [nama supplier] - Rp [X]
- 🟢 Target penjualan bulan ini: [X]% tercapai

---

### Modul 2: POS (Point of Sales / Kasir)

Antarmuka kasir untuk transaksi penjualan harian dengan dukungan **multi-keranjang**, **kas session per kasir**, dan **pembayaran lintas kasir**.

---

#### 2.1 Kas Session (Shift Kasir)

Sebelum mulai transaksi, setiap kasir **wajib membuka shift** dengan menyetor saldo awal kas. Semua transaksi dalam shift tercatat ke kasir tersebut. Di akhir shift kasir menutup dengan rekonsiliasi.

```
┌─────────────────────────────────────────────────────┐
│  🟢 Buka Shift — Andi Pratama                       │
│  Tanggal: 15/01/2025   Mulai: 08:00                 │
│  ─────────────────────────────────────────────────  │
│  Saldo Awal Kas Tunai:  [Rp 500.000        ]        │
│                                                     │
│  ⚠️  Hitung uang tunai di laci sebelum mulai        │
│                                                     │
│  [Buka Shift & Mulai Transaksi]                     │
└─────────────────────────────────────────────────────┘
```

**Tutup Shift — Rekonsiliasi Kas:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🔴 Tutup Shift — Andi Pratama          15/01/2025  08:00-16:00 │
│  ───────────────────────────────────────────────────────────── │
│  Saldo Awal                                      Rp    500.000  │
│  Total Penjualan Tunai (23 transaksi)            Rp  3.450.000  │
│  Total Kembalian                                -Rp    280.000  │
│  ─────────────────────────────────────────────────────────────  │
│  Kas Seharusnya                                  Rp  3.670.000  │
│  Kas Aktual (hitung fisik):             [Rp 3.670.000        ]  │
│  Selisih:                                        Rp          0  │
│  ─────────────────────────────────────────────────────────────  │
│  Transaksi Non-Tunai                                            │
│  Kartu                                           Rp    750.000  │
│  Transfer                                        Rp    600.000  │
│  Piutang (kredit)                                Rp  1.200.000  │
│  ─────────────────────────────────────────────────────────────  │
│  Catatan: [____________________________]                         │
│  [Tutup Shift & Setor Kas]                                      │
└─────────────────────────────────────────────────────────────────┘
```

- Selisih positif = kelebihan (dicatat untuk audit)
- Selisih negatif = kekurangan kas (🔴 alert ke manajer)
- Manajer dapat melihat ringkasan semua shift dalam satu hari

---

#### 2.2 Multi-Keranjang per Kasir

Setiap kasir bisa membuka **hingga 5 keranjang aktif** sekaligus — satu per customer yang sedang dilayani. Keranjang yang "ditahan" (hold) tidak hilang, bisa kembali dilanjutkan kapan saja.

**Layout POS dengan Multi-Keranjang:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 👤 Andi  📍 Sudirman  💼 Shift: 08:00   Kas: Rp 3.670.000  [Tutup Shift]│
├──────────────────────────────────────────────────────────────────────────┤
│ Tab Keranjang:                                                           │
│ [🛒 #1 Pak Budi ●] [🛒 #2 Umum ●] [🛒 #3 Kosong] [🛒 #4 Kosong] [+ Baru]│
├──────────────────────┬───────────────────────────┬───────────────────────┤
│  KATALOG PRODUK      │  KERANJANG #1 — Pak Budi  │  PEMBAYARAN           │
│                      │                           │                       │
│  🔍 Cari / Barcode   │  Semen Portland 50kg      │  Subtotal  Rp 195.000 │
│  ────────────────    │  [-](2)[+]      Rp 130.000│  Diskon         Rp  0 │
│  [Semua][Semen]      │                           │  ════════════════════ │
│  [Cat][Pipa][Besi]   │  Cat Tembok Putih 5kg     │  Total     Rp 195.000 │
│                      │  [-](1)[+]       Rp 45.000│                       │
│  ┌──────┐ ┌──────┐   │                           │  [💵 Tunai]  [💳 Kartu]│
│  │ 🧱   │ │ 🎨   │   │  Pipa PVC 3/4" x5         │  [🏦 Transfer][📋 Kredit]│
│  │Semen │ │Cat   │   │  [-](5)[+]       Rp 20.000│                       │
│  │65.000│ │45.000│   │                           │  Dibayar: [Rp 200.000]│
│  │Stk:80│ │Stk:3 │   │  ────────────────────     │  Kembali:  Rp   5.000 │
│  │  [+] │ │  [+] │   │  Diskon: [  0  ] %        │                       │
│  └──────┘ └──────┘   │  Catatan: [__________]    │  [    BAYAR     ]     │
│                      │                           │                       │
│                      │  [🔒 Hold]  [🗑 Kosongkan] │  [🔄 Ambil Alih SO]   │
└──────────────────────┴───────────────────────────┴───────────────────────┘
```

**Perilaku multi-keranjang:**

| Aksi | Hasil |
|------|-------|
| Klik tab keranjang kosong `[+ Baru]` | Buka keranjang baru untuk customer baru |
| Klik `[🔒 Hold]` | Keranjang disimpan, tab berubah jadi abu-abu — bisa switch ke customer lain |
| Klik tab keranjang yang di-hold | Lanjutkan melayani customer tersebut |
| Klik `[🗑 Kosongkan]` | Batalkan keranjang (konfirmasi dulu) |
| Tekan `BAYAR` | Proses pembayaran, keranjang selesai, tab otomatis kosong |

---

#### 2.3 Pembayaran Lintas Kasir

Pesanan yang sudah diinput kasir A **bisa dibayar ke kasir B** — untuk kasus customer pindah antrian atau kasir A sedang sibuk.

**Cara kerja:**
1. Kasir B klik **"🔄 Ambil Alih Pesanan"** di panel pembayaran
2. Muncul daftar keranjang aktif dari semua kasir yang sedang hold:

```
┌──────────────────────────────────────────────────────────┐
│  🔄 Ambil Alih Pesanan                                   │
│  ──────────────────────────────────────────────────────  │
│  Kasir    Keranjang  Customer     Total         Waktu    │
│  Andi     #1         Pak Budi     Rp 195.000   14 menit  │
│  Andi     #2         Umum         Rp  65.000    3 menit  │
│  Siti     #1         PT ABC       Rp 850.000   27 menit  │
│  ──────────────────────────────────────────────────────  │
│  [Pilih & Ambil Alih]                                   │
└──────────────────────────────────────────────────────────┘
```

3. Kasir B pilih keranjang → keranjang pindah ke tab kasir B → proses bayar
4. Di laporan: transaksi tercatat **diinput oleh Andi, dibayar oleh Siti** — keduanya tercatat untuk audit

---

**Fitur Khusus Toko Bangunan:**
- Penjualan **per unit, per meter, per kilogram, per dus** (unit fleksibel)
- Auto-update harga dari master harga (solusi masalah harga salah)
- Struk digital + print thermal (mencantumkan nama kasir input dan kasir bayar jika berbeda)
- Riwayat transaksi hari ini dengan kemampuan void/retur

**Metode Pembayaran di POS & Cara Konfirmasi:**

| Metode | Perangkat | Cara Kasir Konfirmasi | Kas Tercatat |
|--------|-----------|----------------------|--------------|
| 💵 Tunai | — | Input nominal diterima, hitung kembalian | Otomatis ke kas tunai shift |
| 💳 Kartu Debit/Kredit | EDC | Tunggu EDC approved, klik Konfirmasi | Tercatat sebagai non-tunai |
| 📱 QRIS via EDC | EDC | Tunggu EDC bunyi/approved, klik Konfirmasi | Tercatat sebagai non-tunai |
| 📱 QRIS via GoPay/OVO | HP merchant | Dengar suara notif nominal, klik Konfirmasi | Tercatat sebagai non-tunai |
| 🏦 Transfer | — | Cek rekening / notif bank, klik Konfirmasi | Tercatat sebagai non-tunai |
| 📋 Piutang/Kredit | — | Cek limit customer, klik Konfirmasi | Masuk modul AR |

> **Prinsip:** semua metode non-tunai tetap dikonfirmasi **manual oleh kasir** setelah kasir memverifikasi sendiri (lihat EDC, dengar GoPay, cek rekening). SES tidak terintegrasi ke payment gateway — tidak ada biaya tambahan per transaksi.

**Panel Pembayaran POS — Detail per Metode:**

```
─── Tunai ──────────────────────────────────────────────────────────
  Total: Rp 195.000
  Dibayar: [Rp 200.000    ]
  Kembali: Rp 5.000
  [✅ BAYAR TUNAI]

─── QRIS (EDC / GoPay / OVO) ───────────────────────────────────────
  Total: Rp 195.000
  Metode QRIS: [📱 GoPay ▼]  (EDC / GoPay / OVO / QRIS Lainnya)

  ⚠️  Pastikan notifikasi pembayaran sudah diterima
      sebelum klik Konfirmasi

  [✅ KONFIRMASI QRIS DITERIMA]

─── Transfer ────────────────────────────────────────────────────────
  Total: Rp 195.000
  Rekening tujuan: BCA 1234567890 a/n Toko Simetri

  ⚠️  Cek mutasi rekening sebelum klik Konfirmasi

  Ref transfer (opsional): [________________]
  [✅ KONFIRMASI TRANSFER DITERIMA]

─── Piutang / Kredit ────────────────────────────────────────────────
  Customer: [PT Abadi Jaya Konstruksi  ▼]
  Limit    : Rp 50.000.000
  Terpakai : Rp 12.000.000
  Sisa Limit: Rp 38.000.000  ← Rp 195.000 akan mengurangi sisa ini
  Jatuh tempo: +30 hari (18 Feb 2025)
  [✅ CATAT SEBAGAI PIUTANG]
```

---

### Modul 3: Inventory (Stok & Gudang)

Mengatasi: Stok tidak akurat, barang hilang/dicuri, kehabisan fast-moving.

**Sub-menu:**
- Daftar Produk / Master Barang
- Penerimaan Barang (dari supplier)
- Pengeluaran Barang (manual / penyesuaian)
- Stock Opname
- Riwayat Mutasi Stok
- Pengaturan Reorder Point

**Tampilan Master Barang:**
```
┌────────────────────────────────────────────────────────────────────────┐
│ 📦 Master Barang                          [+ Tambah Barang] [Import]   │
│ 🔍 Cari...  Filter: [Semua Kategori ▼] [Semua Status ▼]              │
│ ────────────────────────────────────────────────────────────────────── │
│ SKU       Nama Barang        Kategori   Stok  Min  Harga Beli  H.Jual  │
│ BRG-001   Semen Portland 50kg Semen     80    20   Rp 57.000  Rp 65.000│
│ BRG-002   Bata Merah           Bata     1200  500  Rp 800     Rp 1.100 │
│ BRG-003   Cat Tembok 5kg  🔴  Cat       3     10   Rp 38.000  Rp 45.000│
│           (Stok Kritis!)                                                │
└────────────────────────────────────────────────────────────────────────┘
```

**Stock Opname Flow:**
1. Buat sesi stock opname (pilih kategori/gudang)
2. Input stok fisik per barang
3. Sistem hitung selisih (sistem vs fisik)
4. Selisih negatif → potensi barang hilang/dicuri → ditandai untuk audit
5. Approval oleh manajer → stok disesuaikan, selisih dicatat sebagai "Penyesuaian Stok"

**Notifikasi Reorder Point:**
- Sistem otomatis cek stok setiap hari
- Jika stok ≤ reorder point → notifikasi merah di dashboard & top bar
- Bisa langsung buat Purchase Order dari notifikasi

---

### Modul 4: Keuangan & Cash Flow

Mengatasi: Tidak bisa mengetahui cash flow, sulit mengetahui laba sebenarnya.

**Sub-menu:**
- Kas & Bank (Buku Kas)
- Jurnal Umum
- Laporan Laba Rugi
- Laporan Cash Flow
- Neraca

**Tampilan Kas & Bank:**
```
┌────────────────────────────────────────────────────────────────────────┐
│ 💰 Kas & Bank                                      Periode: [Jan 2025]│
│ ────────────────────────────────────────────────────────────────────── │
│  📊 Saldo Hari Ini                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │ 🏦 Kas Tunai    │  │ 🏦 Rekening BCA  │  │ 🏦 Rekening BRI  │       │
│  │ Rp 8.500.000    │  │ Rp 45.200.000   │  │ Rp 23.100.000   │       │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                        │
│  Transaksi Terbaru                         [+ Catat Pengeluaran]       │
│  ──────────────────────────────────────────────────────────────────── │
│  Tgl       Keterangan               Masuk        Keluar      Saldo     │
│  15/01     Penjualan POS #001    Rp 4.500.000               ...        │
│  15/01     Bayar listrik                        Rp 1.200.000 ...       │
│  14/01     Bayar supplier Toko A               Rp 25.000.000 ...       │
└────────────────────────────────────────────────────────────────────────┘
```

**Laba Rugi Otomatis:**
- Penjualan (dari POS) - HPP (dari harga beli di inventory) = **Laba Kotor**
- Laba Kotor - Biaya Operasional = **Laba Bersih**
- Real-time, tidak perlu dihitung manual

---

### Modul 2b: Sales Order (SO) — Pesanan & Indent

Mengatasi kebutuhan **pesanan besar yang melebihi stok toko**, di mana sebagian atau seluruh barang dipenuhi langsung dari supplier ke lokasi klien tanpa melewati gudang toko.

> **Konsep inti:** Sales Order adalah dokumen *pesanan* dari pelanggan. Berbeda dengan transaksi POS (yang langsung selesai di kasir), SO bisa punya siklus hidup beberapa hari — dari konfirmasi pesanan, pemenuhan stok, hingga pengiriman dan penagihan.

**Kapan pakai SO vs POS:**

| Situasi | Pakai |
|---------|-------|
| Pelanggan beli langsung, bayar di kasir, barang langsung dibawa | **POS** |
| Pelanggan pesan dulu, barang disiapkan, dikirim ke lokasi | **SO** |
| Pesanan melebihi stok toko, kekurangannya di-indent ke supplier | **SO** |
| Seluruh barang di-indent dari supplier langsung ke klien | **SO** |

**Sub-menu:**
- Daftar Sales Order
- Buat Sales Order Baru
- Pemenuhan SO (Fulfillment)
- Riwayat SO selesai

**Alur Sales Order — 3 Skenario:**

```
── Skenario A: Stok Cukup di Toko ──────────────────────────────────────
Buat SO → Konfirmasi → Ambil dari Stok Toko → Kirim ke Klien
→ Invoice ke Klien → Terima Bayar → Selesai

── Skenario B: Partial Indent (kasus paling umum) ───────────────────────
Contoh: Klien pesan 10.8 kubik bata ringan, stok toko 5 kubik

Buat SO (10.8 kubik total)
 ├─ 5 kubik → dari Stok Toko (stok berkurang)
 └─ 5.8 kubik → Buat PO Indent ke Supplier
                 → Supplier kirim langsung ke lokasi klien
                 → Stok TIDAK melalui toko, TIDAK mengurangi stok toko

Setelah semua terpenuhi → Invoice ke Klien → Terima Bayar → Selesai

── Skenario C: Full Indent (semua dari supplier) ────────────────────────
Buat SO → Buat PO Indent → Supplier kirim ke Klien
→ Invoice ke Klien → Terima Bayar → Selesai
```

**Form Sales Order:**
```
┌────────────────────────────────────────────────────────────────────────┐
│ 📋 Sales Order Baru                                  SO-2025-01-0012   │
│ ────────────────────────────────────────────────────────────────────── │
│ Pelanggan: [PT Abadi Jaya Konstruksi     ▼]   Tgl SO: [15/01/2025]    │
│ Alamat Kirim: [Jl. Proyek No. 5, Bekasi          ]                     │
│ Est. Kirim:  [18/01/2025]                                              │
│ ────────────────────────────────────────────────────────────────────── │
│  #  Nama Barang        Qty    Sat  H.Jual    Sumber         Subtotal   │
│  1  Bata Ringan 7.5cm  10.8  Kubik  85.000  ┌──────────┐  Rp 918.000  │
│                                              │ 🏪 Toko  │             │
│                                              │ 5 kubik  │             │
│                                              │ 🚚 Indent│             │
│                                              │ 5.8 kubik│             │
│                                              └──────────┘             │
│  2  Semen Portland 50kg  20   Sak    65.000  🏪 Toko       Rp 1.300.000│
│  [+ Tambah Item]                                                       │
│ ────────────────────────────────────────────────────────────────────── │
│  Subtotal: Rp 2.218.000   Diskon: [___]   Total: Rp 2.218.000          │
│  Catatan: [_________________________________]                          │
│  [Simpan Draft]  [Konfirmasi SO]                                       │
└────────────────────────────────────────────────────────────────────────┘
```

**Halaman Fulfillment SO:**

Setelah SO dikonfirmasi, sistem tampilkan rencana pemenuhan per item:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🔄 Pemenuhan SO-2025-01-0012 — PT Abadi Jaya                           │
│ ────────────────────────────────────────────────────────────────────── │
│ Item              Total   Sumber       Qty    Status                   │
│ ─────────────────────────────────────────────────────────────────────  │
│ Bata Ringan 7.5cm  10.8k  🏪 Stok Toko  5k   ✅ Siap diambil          │
│                           🚚 Indent     5.8k  🟡 PO-2025-01-0031       │
│                                               (menunggu supplier)       │
│ Semen Portland 50kg 20sak 🏪 Stok Toko  20sak ✅ Siap diambil          │
│ ────────────────────────────────────────────────────────────────────── │
│ PO Indent terkait:  PO-2025-01-0031  →  Supplier: PT Bata Ringan Indo  │
│                     Status: 🟡 Dikirim, estimasi tiba 18/01            │
│                                                                        │
│ Pembayaran Pelanggan:                                                  │
│ DP sudah masuk: Rp 1.000.000 (45%)  Sisa: Rp 1.218.000               │
│ ────────────────────────────────────────────────────────────────────── │
│ [Tandai Terkirim ke Klien]  [Buat Invoice]                             │
└────────────────────────────────────────────────────────────────────────┘
```

**Status SO:**
- 📝 `Draft` — belum dikonfirmasi
- ✅ `Dikonfirmasi` — pesanan diterima, sedang disiapkan
- 🔵 `Sebagian Dikirim` — ada item yang sudah dikirim, ada yang belum
- 🟢 `Selesai` — semua item dikirim, invoice lunas
- 🔴 `Dibatalkan`

**Pencatatan Keuangan Otomatis dari SO:**
- Saat SO konfirmasi + ada DP → masuk ke kas sebagai uang muka
- Saat PO Indent dibuat dari SO → otomatis tercatat sebagai hutang supplier
- Saat SO selesai → otomatis buat invoice ke pelanggan (piutang jika belum lunas)
- Margin = Harga jual ke klien − HPP stok toko − harga beli indent supplier

---

Mengatasi: Sulit mengontrol piutang pelanggan, sulit mengontrol hutang supplier.

**Sub-menu:**
- Piutang Pelanggan (AR)
- Pembayaran Piutang (Terima Bayar)
- Hutang Supplier (AP)
- Pembayaran Hutang (Bayar Hutang)
- Laporan Aging (Umur Piutang/Hutang)

**Tampilan Piutang (AR):**
```
┌────────────────────────────────────────────────────────────────────────┐
│ 📄 Piutang Pelanggan                    Total: Rp 87.400.000           │
│ 🔍 Cari pelanggan...    Filter: [Semua] [Belum Lunas] [Jatuh Tempo]   │
│ ────────────────────────────────────────────────────────────────────── │
│ Pelanggan         Transaksi  Jatuh Tempo  Sisa Piutang   Status        │
│ PT Abadi Jaya     INV-0021   15 Jan 2025  Rp 12.000.000  🔴 Terlambat  │
│ Toko Pak Budi     INV-0032   20 Jan 2025  Rp 5.500.000   🟡 3 hari lagi│
│ CV Maju Bersama   INV-0045   01 Feb 2025  Rp 8.000.000   🟢 Tepat waktu│
│                                                                        │
│  Aging Summary:                                                        │
│  1-30 hari: Rp 45.000.000  |  31-60 hari: Rp 28.000.000              │
│  61-90 hari: Rp 10.000.000  |  >90 hari: Rp 4.400.000                 │
└────────────────────────────────────────────────────────────────────────┘
```

**Notifikasi Otomatis:**
- H-3 sebelum jatuh tempo → notifikasi kuning
- Hari H jatuh tempo → notifikasi merah
- Lewat jatuh tempo → notifikasi merah + tampil di dashboard

---

### Modul 6: Pembelian ke Supplier (Purchase Order)

Mengatasi: Sulit mengontrol hutang supplier, sering kehabisan stok.

**Sub-menu:**
- Purchase Order (PO)
- Penerimaan Barang (Good Receipt)
- Daftar Supplier
- Riwayat Pembelian

**Dua Jenis PO:**

| Jenis | Kapan | Barang tiba di |
|-------|-------|----------------|
| **PO Reguler** | Restok stok toko | Gudang toko → stok bertambah |
| **PO Indent** | Fulfill pesanan SO yang melebihi stok | Langsung ke lokasi klien → stok toko **tidak berubah** |

PO Indent otomatis tercipta dari halaman Fulfillment SO, atau bisa dibuat manual dengan menandainya sebagai indent dan mengisi referensi SO.

**Alur PO Reguler:**
```
Notifikasi Stok Kritis → Buat PO → Kirim ke Supplier
→ Terima Barang di Toko (GR) → Stok Otomatis Bertambah
→ Tagihan Masuk → Catat Hutang → Bayar Hutang → Lunas
```

**Alur PO Indent:**
```
SO Dikonfirmasi → Buat PO Indent (referensi: SO-xxx)
→ Kirim ke Supplier → Supplier Kirim Langsung ke Klien
→ Konfirmasi Pengiriman → Stok Toko TIDAK Berubah
→ Tagihan Supplier Masuk → Catat Hutang → Bayar Hutang → Lunas
→ SO terkait diupdate: item indent = "Terkirim"
```

**Form Purchase Order:**
```
┌────────────────────────────────────────────────────────────────────────┐
│ 🛍️ Purchase Order Baru                               PO-2025-01-0031  │
│ ────────────────────────────────────────────────────────────────────── │
│ Jenis PO:  ● PO Reguler (ke gudang toko)                               │
│            ○ PO Indent  (langsung ke klien)  Ref SO: [SO-2025-01-0012]│
│ ────────────────────────────────────────────────────────────────────── │
│ Supplier:   [PT Bata Ringan Indonesia       ▼]                         │
│ Tgl PO:    [15 Jan 2025]    Tgl Est. Kirim: [18 Jan 2025]              │
│ Kirim ke:  [🏪 Gudang Toko] / [📍 Jl. Proyek No. 5, Bekasi  ] ← indent│
│ ────────────────────────────────────────────────────────────────────── │
│  #   SKU      Nama Barang          Qty   Sat   Harga Beli   Subtotal   │
│  1   BRG-010  Bata Ringan 7.5cm   5.8   Kubik  Rp 65.000  Rp 377.000  │
│  [+ Tambah Item]                                                       │
│ ────────────────────────────────────────────────────────────────────── │
│  Total PO:  Rp 377.000          Catatan: [________________]            │
│  [Simpan Draft]  [Kirim ke Supplier]                                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Modul 7: Laporan & BI Dashboard

Mengatasi: Pembuatan laporan sangat lama, pengambilan keputusan berdasarkan perasaan.

**Sub-menu:**
- Laporan Penjualan
- Laporan Stok & Pergerakan Barang
- Laporan Laba Rugi
- Laporan Cash Flow
- Laporan Piutang & Hutang
- Laporan Audit Karyawan (transaksi per kasir)
- Laporan Barang Terlaris
- Laporan Selisih Stock Opname (barang hilang/dicuri)

**Dashboard Laporan:**
```
┌────────────────────────────────────────────────────────────────────────┐
│ 📊 Laporan & Analitik                   Periode: [Bulan Ini ▼] [Export]│
│ ────────────────────────────────────────────────────────────────────── │
│  ┌────────────────────────┐  ┌────────────────────────┐               │
│  │  Penjualan Harian      │  │  Top 10 Barang Terlaris │               │
│  │  📈 Line Chart         │  │  📊 Horizontal Bar      │               │
│  │  Jan 1-31, 2025        │  │                         │               │
│  └────────────────────────┘  └────────────────────────┘               │
│  ┌────────────────────────┐  ┌────────────────────────┐               │
│  │  Laba Kotor vs Bersih  │  │  Selisih Stock Opname  │               │
│  │  💰 Bar Chart          │  │  ⚠️  Tabel Selisih      │               │
│  │  Bulan Jan-Des         │  │  Potensi kerugian: Rp X│               │
│  └────────────────────────┘  └────────────────────────┘               │
│                                                                        │
│  [📥 Export PDF]  [📥 Export Excel]  [🖨️ Cetak]                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Laporan Audit Karyawan:**
- Setiap transaksi POS tercatat: kasir siapa, jam berapa, nominal berapa
- Laporan void/retur per kasir
- Laporan diskon berlebihan per kasir
- Deteksi anomali: transaksi diluar jam kerja

---

### Modul 8: Customer Portal — Order Online Mandiri

Portal web terpisah per tenant yang memungkinkan customer memesan secara mandiri, melihat riwayat order, dan mengelola status keanggotaan mereka. Terhubung langsung ke sistem internal SES (stok, SO, piutang) namun dengan tampilan yang berbeda — customer-facing bukan operator-facing.

**URL portal per tenant:**
```
ses.id/toko-simetri        ← portal customer Toko Bangunan Simetri
ses.id/maju-jaya           ← portal customer Toko Maju Jaya
ses.id/berkah-makmur       ← portal customer UD Berkah Makmur
```
Atau bisa custom domain: `order.tokosimetri.com`

---

#### 8.1 Tipe Customer & Alur Pembayaran

```
CUSTOMER BARU (belum daftar)
  → Lihat katalog ✅
  → Mau order → Wajib daftar dulu

CUSTOMER TERDAFTAR — belum diapprove
  → Order masuk → Status: Menunggu Konfirmasi Toko
  → Toko approve → Customer dapat notif: "Order disetujui, silakan transfer"
  → Setelah bukti transfer diupload & dikonfirmasi toko → order diproses

CUSTOMER MEMBER (sudah diapprove toko)
  → Order masuk → Langsung diproses
  → Pembayaran: TEMPO (sesuai limit & termin yang diset toko)
  → Tagihan masuk ke modul Piutang SES secara otomatis

CUSTOMER MEMBER — request naik ke TEMPO
  → Ajukan request tempo di portal
  → Toko review & approve/tolak di dashboard SES
  → Jika diapprove: credit limit & payment terms diset toko
```

**Status customer di portal:**

| Status | Warna | Keterangan |
|--------|-------|------------|
| `Baru` | ⚫ Abu | Baru daftar, belum ada order |
| `Menunggu Approval` | 🟡 Kuning | Sudah order, toko belum konfirmasi |
| `Aktif — Transfer` | 🔵 Biru | Diapprove, wajib bayar transfer dulu |
| `Member — Tempo` | 🟢 Hijau | Diapprove tempo, bisa order tanpa bayar dulu |
| `Diblokir` | 🔴 Merah | Piutang macet / melanggar aturan |

---

#### 8.2 Halaman Katalog Produk

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🏪 Toko Bangunan Simetri          [🔍 Cari produk...]   [👤 Login] │
│ ─────────────────────────────────────────────────────────────────── │
│ Cabang: [Sudirman ▼]   Kategori: [Semua ▼]   Urutkan: [A-Z ▼]     │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐              │
│ │ 🧱            │ │ 🎨            │ │ 🔧            │              │
│ │ Semen         │ │ Cat Tembok    │ │ Pipa PVC 3/4" │              │
│ │ Portland 50kg │ │ Putih 5kg     │ │               │              │
│ │ Rp 65.000/sak │ │ Rp 45.000/klg │ │ Rp 22.000/btg │              │
│ │ 🟢 Tersedia   │ │ 🟡 Terbatas   │ │ 🟢 Tersedia   │              │
│ │ [+ Pesan]     │ │ [+ Pesan]     │ │ [+ Pesan]     │              │
│ └───────────────┘ └───────────────┘ └───────────────┘              │
│                                                                     │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐              │
│ │ 🧱            │ │               │ │               │              │
│ │ Bata Merah    │ │ Keramik 40x40 │ │ Besi Hollow   │              │
│ │ Rp 1.100/pcs  │ │ Rp 78.000/dus │ │ Rp 45.000/btg │              │
│ │ 🔴 Habis      │ │ 🟢 Tersedia   │ │ 🟢 Tersedia   │              │
│ │ [Beritahu Saya]│ │ [+ Pesan]     │ │ [+ Pesan]     │              │
│ └───────────────┘ └───────────────┘ └───────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

**Status stok yang tampil ke customer (tidak tampilkan angka):**
- 🟢 `Tersedia` → `stock + legacyStock > reorderPoint`
- 🟡 `Terbatas` → `stock + legacyStock ≤ reorderPoint && > 0`
- 🔴 `Habis` → `stock + legacyStock = 0`

Tombol **"Beritahu Saya"** pada produk habis → customer bisa request notif WA saat stok kembali ada.

---

#### 8.3 Keranjang & Checkout

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🛒 Keranjang Pesanan                                                │
│ ─────────────────────────────────────────────────────────────────── │
│ Cabang: Sudirman (Jl. Sudirman No. 45)                             │
│                                                                     │
│ 🧱 Semen Portland 50kg                                              │
│    Rp 65.000 / sak    [-] 10 [+]    Subtotal: Rp 650.000           │
│                                                                     │
│ 🎨 Cat Tembok Putih 5kg                                             │
│    Rp 45.000 / kaleng  [-]  5 [+]   Subtotal: Rp 225.000           │
│                                                                     │
│ ─────────────────────────────────────────────────────────────────── │
│ Alamat Pengiriman / Catatan Lokasi Proyek:                          │
│ [Jl. Proyek Perumahan Blok A, Bekasi                             ]  │
│                                                                     │
│ Catatan tambahan (opsional):                                        │
│ [Mohon kirim sebelum jam 10 pagi                                 ]  │
│ ─────────────────────────────────────────────────────────────────── │
│ Total Pesanan:                                    Rp 875.000        │
│                                                                     │
│ Metode Bayar:                                                       │
│ ○ 🏦 Transfer Bank                                                  │
│ ○ 📱 GoPay                                                          │
│ ○ 📋 Tempo / Kredit  ← hanya muncul jika customer Member Tempo     │
│                                                                     │
│ [Kirim Pesanan →]                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Perbedaan alur per metode bayar di portal:**

| Metode | Siapa yang konfirmasi | Langkah customer | Langkah toko |
|--------|----------------------|------------------|--------------|
| Transfer | Toko (manual cek rekening) | Upload foto bukti transfer | Cek rekening → klik Konfirmasi |
| GoPay | Toko (manual cek notif GoPay merchant) | Screenshot notif GoPay → upload | Cek notif GoPay HP → klik Konfirmasi |
| Tempo | — (langsung proses) | Tidak perlu bayar dulu | Order langsung masuk SO + AR |

> **Catatan penting:** Baik Transfer maupun GoPay sama-sama perlu konfirmasi manual oleh toko. Bedanya hanya **cara customer membuktikan** — Transfer kirim foto struk transfer, GoPay kirim screenshot notif berhasil dari aplikasi GoPay. Toko tetap yang memverifikasi sebelum order diproses.

---

#### 8.4 Alur Setelah Order Dikirim

**Untuk customer Transfer:**

```
Customer kirim order (pilih Transfer)
  ↓
Toko terima notif WA → Review → Approve
  ↓
Customer terima notif WA: instruksi rekening tujuan + link upload bukti
  ↓
Customer transfer → upload foto struk transfer di portal
  ↓
Toko cek mutasi rekening → klik "Konfirmasi Transfer Diterima"
  ↓
Order masuk ke SO internal → Toko proses & kirim
  ↓
Customer dapat update status via WA
```

**Untuk customer GoPay:**

```
Customer kirim order (pilih GoPay)
  ↓
Toko terima notif WA → Review → Approve
  ↓
Customer terima notif WA: nomor GoPay merchant toko + link upload bukti
  ↓
Customer bayar via GoPay → screenshot notif "Pembayaran Berhasil"
  → upload screenshot di portal
  ↓
Toko cek notif di HP GoPay merchant → bunyi nominal sesuai
  → klik "Konfirmasi GoPay Diterima"
  ↓
Order masuk ke SO internal → Toko proses & kirim
  ↓
Customer dapat update status via WA
```

**Untuk customer Member Tempo:**

```
Customer kirim order (pilih Tempo)
  ↓
Toko terima notif WA (otomatis)
  ↓
Order langsung masuk ke SO internal (tanpa perlu bayar dulu)
  ↓
Tagihan otomatis masuk ke modul Piutang SES
  ↓
Toko proses & kirim → Customer dapat update status
```

**Halaman Upload Bukti Bayar (Transfer & GoPay):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📎 Upload Bukti Pembayaran — ORD-2025-01-0045                       │
│ ─────────────────────────────────────────────────────────────────── │
│ Total yang harus dibayar: Rp 875.000                                │
│                                                                     │
│ [Jika Transfer]                                                     │
│ Kirim ke: BCA 1234567890 a/n Toko Bangunan Simetri                 │
│                                                                     │
│ [Jika GoPay]                                                        │
│ GoPay Merchant: 0812-3456-7890 (Toko Bangunan Simetri)             │
│                                                                     │
│ ─────────────────────────────────────────────────────────────────── │
│ Upload bukti:                                                       │
│ ┌─────────────────────────────────────┐                             │
│ │  📷 Foto struk transfer /           │                             │
│ │     screenshot notif GoPay          │                             │
│ │  [Pilih File / Ambil Foto]          │                             │
│ └─────────────────────────────────────┘                             │
│                                                                     │
│ Catatan (opsional): [____________________________]                  │
│ [📤 Kirim Bukti Pembayaran]                                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Dashboard Konfirmasi Pembayaran (di SES internal):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ 💳 Konfirmasi Pembayaran Masuk                                       │
│ ─────────────────────────────────────────────────────────────────── │
│ ORD-0045  Budi Santoso  Rp 875.000  📱 GoPay   15 Jan 14:23        │
│                                                                     │
│ Bukti yang diupload customer:                                       │
│ ┌───────────────────────────┐                                       │
│ │  🖼️ screenshot_gopay.jpg  │                                       │
│ │  [Lihat Gambar Penuh]     │                                       │
│ └───────────────────────────┘                                       │
│                                                                     │
│ ⚠️  Cek notif GoPay merchant di HP kamu sebelum konfirmasi          │
│                                                                     │
│ [❌ Tolak — Bukti Tidak Valid]   [✅ Konfirmasi Pembayaran Diterima] │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### 8.5 Notifikasi WhatsApp — Format Pesan

Semua notif WA dikirim via **WhatsApp Business API** (atau Fonnte/WA Gateway) ke nomor WA toko yang didaftarkan di settings.

**Notif ke TOKO saat order masuk:**
```
🔔 *Pesanan Baru — SES*
Toko: Simetri Sudirman

No. Order : ORD-2025-01-0045
Customer  : Budi Santoso (08123456789)
Status    : Baru Daftar / Transfer

Produk:
• Semen Portland 50kg × 10 = Rp 650.000
• Cat Tembok Putih 5kg × 5 = Rp 225.000

Total     : Rp 875.000
Kirim ke  : Jl. Proyek Perumahan Blok A, Bekasi
Catatan   : Mohon kirim sebelum jam 10 pagi

👉 Balas WA ini untuk komunikasi dengan customer
📋 Detail: ses.id/toko-simetri/dashboard/orders/ORD-0045
```

**Notif ke CUSTOMER saat order diapprove — Transfer:**
```
✅ *Pesanan Disetujui — Toko Simetri*

No. Order : ORD-2025-01-0045
Total     : Rp 875.000

Silakan transfer ke:
🏦 BCA 1234567890
   a/n Toko Bangunan Simetri

Upload bukti transfer:
👉 ses.id/toko-simetri/orders/ORD-0045/payment

Ada pertanyaan? Balas pesan ini.
```

**Notif ke CUSTOMER saat order diapprove — GoPay:**
```
✅ *Pesanan Disetujui — Toko Simetri*

No. Order : ORD-2025-01-0045
Total     : Rp 875.000

Silakan bayar via GoPay ke:
📱 0812-3456-7890
   (Toko Bangunan Simetri)

Setelah bayar, upload screenshot notif GoPay:
👉 ses.id/toko-simetri/orders/ORD-0045/payment

Ada pertanyaan? Balas pesan ini.
```

**Notif ke CUSTOMER saat status order berubah:**
```
📦 *Update Pesanan #ORD-0045*
Status: Sedang Disiapkan ← / Dikirim ← / Selesai

[jika Dikirim]
Estimasi tiba: 17 Jan 2025
Info pengiriman: Hub. 08xxx (pengemudi)

Toko Bangunan Simetri
```

**Notif ke TOKO saat piutang member jatuh tempo (H-3):**
```
⚠️ *Piutang Jatuh Tempo — SES*

Customer : PT Abadi Jaya
Order    : ORD-0032, ORD-0038
Total    : Rp 12.400.000
Jatuh tempo: 18 Jan 2025 (3 hari lagi)

📋 ses.id/toko-simetri/dashboard/ar
```

---

#### 8.6 Halaman Riwayat Order Customer

```
┌─────────────────────────────────────────────────────────────────────┐
│ 👤 Halo, Budi Santoso          Status: 🔵 Aktif — Transfer         │
│ ─────────────────────────────────────────────────────────────────── │
│ [Pesanan Saya]  [Profil]  [Request Tempo]                           │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ ORD-2025-01-0045          17 Jan 2025         Rp 875.000            │
│ 🟡 Menunggu Transfer                          [Upload Bukti]        │
│                                                                     │
│ ORD-2025-01-0031          10 Jan 2025         Rp 1.300.000          │
│ 🟢 Selesai                                    [Pesan Lagi]          │
│                                                                     │
│ ORD-2025-01-0018          03 Jan 2025         Rp 450.000            │
│ 🔴 Dibatalkan — Stok tidak cukup              [Lihat Detail]        │
│                                                                     │
│ ─────────────────────────────────────────────────────────────────── │
│ 💡 Ingin beli dengan tempo/kredit?                                  │
│    [Ajukan Keanggotaan Tempo →]                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### 8.7 Dashboard Internal — Kelola Order Online (di SES)

Tambahan sub-menu di Modul Sales Order:
- **Order Online Masuk** — list semua order dari portal, filter per status
- **Approval Customer** — list customer yang menunggu approval atau request tempo
- **Pengaturan Portal** — aktif/nonaktif portal, nomor WA notif, pesan sambutan

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🌐 Order Online Masuk              Filter: [Semua ▼] [Hari Ini ▼]  │
│ ─────────────────────────────────────────────────────────────────── │
│ No Order   Customer          Total         Status          Aksi     │
│ ORD-0045   Budi Santoso      Rp 875.000   🟡 Menunggu     [Approve] │
│ ORD-0044   PT Abadi Jaya     Rp 4.200.000  🟢 Diproses    [Lihat]  │
│ ORD-0043   Toko Pak Hendra   Rp 650.000   🔵 Bayar Lunas  [Lihat]  │
│ ─────────────────────────────────────────────────────────────────── │
│ 👥 Request Approval Customer                                         │
│ Siti Aminah   081234xxxxx   Baru Daftar   [Approve Transfer] [Tolak]│
│ CV Makmur     082345xxxxx   Request Tempo [Review]           [Tolak]│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Structure (Mock Only)

```typescript
// ─── OFFLINE & SYNC ────────────────────────────────────────────

// Antrean transaksi yang dibuat saat offline
interface QueuedTransaction {
  localId: string               // UUID lokal, sebelum dapat server ID
  tenantId: string
  branchId: string
  sessionId: string
  payload: SalesTransaction     // payload lengkap siap dikirim ke API
  isOfflineTransaction: boolean
  offlineCreatedAt: Date
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed'
  retryCount: number
  lastRetryAt: Date | null
  serverTxId: string | null     // diisi setelah sync berhasil
  flags: OfflineFlag[]          // diisi oleh backend saat rekonsiliasi
}

type OfflineFlag = 'STOCK_DEFICIT' | 'CREDIT_EXCEEDED' | 'PRICE_CHANGED'

// Status sinkronisasi offline secara keseluruhan
interface OfflineSyncState {
  isOnline: boolean
  pendingCount: number          // jumlah transaksi di queue
  lastSyncAt: Date | null
  syncStatus: 'idle' | 'syncing' | 'error'
  errorMessage: string | null
}

// Hasil rekonsiliasi dari backend Laravel setelah bulk sync
interface BulkSyncResult {
  synced: string[]              // localId yang berhasil
  flagged: FlaggedTransaction[]
  failed: FailedTransaction[]
}

interface FlaggedTransaction {
  localId: string
  serverTxId: string
  flags: OfflineFlag[]
  detail: string                // penjelasan flag untuk manager
}

interface FailedTransaction {
  localId: string
  reason: string                // error teknis, perlu retry
}

// Log rekonsiliasi yang ditampilkan di dashboard manager
interface ReconciliationAlert {
  id: string
  tenantId: string
  branchId: string
  triggeredAt: Date
  totalFlagged: number
  items: ReconciliationAlertItem[]
  isResolved: boolean
  resolvedBy: string | null
  resolvedAt: Date | null
}

interface ReconciliationAlertItem {
  serverTxId: string
  cashierName: string
  flag: OfflineFlag
  productName: string | null
  customerName: string | null
  detail: string
  actionTaken: string | null    // "Stock Adjusted", "AR Noted", dll
}

// ─── TENANT (SAAS LAYER) ───────────────────────────────────────

interface Tenant {
  id: string                   // "ten-001"
  name: string                 // "Toko Bangunan Simetri"
  slug: string                 // "toko-simetri" — untuk URL login
  ownerEmail: string
  phone: string
  plan: 'trial' | 'basic' | 'pro' | 'enterprise'
  trialEndsAt: Date | null
  onboardingStatus: OnboardingStatus
  isActive: boolean
  createdAt: Date
}

interface OnboardingStatus {
  jalur: 'new_store' | 'no_records' | 'manual_records' | 'excel_import'
  completedSteps: string[]     // ['store_info', 'branch', 'users', 'products', 'stock']
  totalProducts: number
  productsWithStock: number    // produk yang sudah ada stok awalnya
  isOnboardingComplete: boolean
  completedAt: Date | null
  // Selama onboarding belum complete → legacyStock mode aktif
  legacyModeActive: boolean
}

// ─── CUSTOMER PORTAL ───────────────────────────────────────────

// Konfigurasi portal per tenant
interface CustomerPortalConfig {
  tenantId: string
  isActive: boolean
  slug: string                  // "toko-simetri" → ses.id/toko-simetri
  customDomain: string | null
  whatsappNumber: string        // nomor WA toko untuk terima notif order
  welcomeMessage: string
  allowGuestBrowse: boolean
  // Metode pembayaran yang diaktifkan toko untuk portal
  paymentMethods: {
    transfer: {
      enabled: boolean
      bankName: string          // "BCA"
      accountNumber: string     // "1234567890"
      accountName: string       // "Toko Bangunan Simetri"
    }
    gopay: {
      enabled: boolean
      merchantPhone: string     // nomor HP GoPay merchant toko
      merchantName: string
    }
  }
}

// Akun customer di portal (terpisah dari SesUser)
interface CustomerAccount {
  id: string
  tenantId: string
  name: string
  email: string
  phone: string                 // nomor WA customer untuk terima notif
  password: string              // hashed
  status: 'new' | 'pending_approval' | 'active_transfer' | 'member_tempo' | 'blocked'
  // Jika member_tempo:
  creditLimit: number
  paymentTermDays: number       // berapa hari tempo
  outstandingDebt: number       // total piutang aktif
  // Referensi ke Customer internal SES (jika sudah ada)
  internalCustomerId: string | null
  approvedBy: string | null     // userId SES yang approve
  approvedAt: Date | null
  notes: string                 // catatan internal toko tentang customer ini
  createdAt: Date
}

// Order dari portal customer
interface OnlineOrder {
  id: string
  tenantId: string
  branchId: string              // cabang yang dipilih customer
  orderNumber: string           // "ORD-2025-01-0045"
  customerAccountId: string
  customerName: string
  customerPhone: string
  items: OnlineOrderItem[]
  deliveryAddress: string
  notes: string
  subtotal: number
  grandTotal: number
  paymentMethod: 'transfer' | 'gopay' | 'tempo'
  paymentStatus: 'unpaid' | 'proof_uploaded' | 'confirmed' | 'paid'
  // Bukti bayar yang diupload customer (berlaku untuk Transfer & GoPay)
  paymentProofUrl: string | null   // URL foto bukti transfer atau screenshot GoPay
  paymentProofUploadedAt: Date | null
  paymentConfirmedBy: string | null   // userId toko yang konfirmasi
  paymentConfirmedAt: Date | null
  status: 'pending_approval'        // menunggu toko approve
    | 'approved'                    // disetujui, menunggu bayar (jika transfer)
    | 'payment_uploaded'            // customer upload bukti, menunggu konfirmasi toko
    | 'processing'                  // toko sedang proses / siapkan barang
    | 'shipped'                     // dikirim
    | 'completed'                   // selesai
    | 'cancelled'                   // dibatalkan
    | 'rejected'                    // ditolak toko
  // Jika sudah diproses toko → terhubung ke SO internal
  salesOrderId: string | null
  // Log notif WA yang sudah dikirim
  waNotifications: WaNotificationLog[]
  createdAt: Date
  updatedAt: Date
}

interface OnlineOrderItem {
  productId: string
  productName: string
  sku: string
  unit: string
  qty: number
  sellingPrice: number          // harga saat order dibuat (snapshot)
  subtotal: number
}

// Log setiap notif WA yang dikirim sistem
interface WaNotificationLog {
  id: string
  recipient: 'store' | 'customer'
  phoneNumber: string
  templateType: 'new_order' | 'approved_transfer' | 'approved_gopay'
    | 'payment_confirmed' | 'processing' | 'shipped'
    | 'completed' | 'rejected' | 'ar_due_soon' | 'stock_available'
  sentAt: Date
  status: 'sent' | 'delivered' | 'failed'
  messagePreview: string        // 100 char pertama dari pesan yang dikirim
}

// Request customer untuk naik status ke Tempo
interface TempoRequest {
  id: string
  tenantId: string
  customerAccountId: string
  customerName: string
  requestedCreditLimit: number
  businessName: string
  businessAddress: string
  notes: string
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy: string | null
  reviewedAt: Date | null
  reviewNotes: string
  createdAt: Date
}



interface SesCompany {
  id: string
  tenantId: string             // ← wajib di semua entitas
  name: string
  address: string
  phone: string
  taxId: string
  logo: string | null
  currency: 'IDR'
  fiscalYearStart: number
}

// ─── CABANG ────────────────────────────────────────────────────

interface Branch {
  id: string
  tenantId: string             // ← wajib di semua entitas
  code: string
  name: string
  address: string
  phone: string
  managerId: string | null
  isActive: boolean
  createdAt: Date
}

// ─── USER & AKSES ──────────────────────────────────────────────

interface SesUser {
  id: string
  tenantId: string             // ← wajib di semua entitas
  name: string
  email: string
  role: 'owner' | 'manager' | 'cashier' | 'warehouse' | 'accountant'
  pin: string
  branchIds: string[]
  isActive: boolean
  createdAt: Date
}

// Session state
interface ActiveSession {
  userId: string
  tenantId: string
  activeBranchId: string | 'all'
}


// ─── INVENTORY ─────────────────────────────────────────────────

// Master produk terpusat per tenant
interface Product {
  id: string
  tenantId: string             // ← isolasi per tenant
  sku: string                  // unik per tenant
  barcode: string | null       // null = belum ada barcode (stok lama)
  name: string
  categoryId: string
  unit: string
  purchasePrice: number        // HPP — hanya owner yang bisa edit
  libraryProductId: string | null  // referensi ke library produk SES jika dipilih saat onboarding
  isActive: boolean
  lastUpdated: Date
}

// Stok & harga jual per cabang
interface BranchProduct {
  id: string
  tenantId: string
  branchId: string
  productId: string
  sellingPrice: number
  stock: number                // stok terverifikasi (dari GR berbarcode)
  legacyStock: number          // stok lama (diinput manual saat onboarding, belum terverifikasi)
  // total stok efektif = stock + legacyStock
  reorderPoint: number
  warehouseLocation: string
}

// Library produk umum toko bangunan — shared, tidak per tenant
interface LibraryProduct {
  id: string
  name: string
  category: string
  defaultUnit: string
  suggestedSellingPrice: number  // rekomendasi harga, bisa diubah tenant
  barcodeSuggestion: string | null
  imageUrl: string | null
}

interface ProductCategory {
  id: string
  tenantId: string
  name: string
  icon: string
}

interface StockMovement {
  id: string
  tenantId: string
  branchId: string
  productId: string
  type: 'in' | 'out' | 'adjustment' | 'opname' | 'transfer_out' | 'transfer_in' | 'legacy_in' | 'legacy_out'
  // legacy_in = input stok lama saat onboarding
  // legacy_out = penjualan dari stok lama
  stockSource: 'verified' | 'legacy'  // dari stok mana yang berkurang
  qty: number
  qtyBefore: number
  qtyAfter: number
  reference: string
  notes: string
  userId: string
  createdAt: Date
}

// Transfer stok antar cabang
interface StockTransfer {
  id: string
  transferNumber: string     // "TRSF-2025-01-001"
  fromBranchId: string
  fromBranchName: string
  toBranchId: string
  toBranchName: string
  items: TransferItem[]
  status: 'draft' | 'sent' | 'received' | 'cancelled'
  notes: string
  createdBy: string          // user dari cabang asal
  confirmedBy: string | null // user dari cabang tujuan yang konfirmasi
  sentAt: Date | null
  receivedAt: Date | null
  createdAt: Date
}

interface TransferItem {
  productId: string
  productName: string
  sku: string
  unit: string
  requestedQty: number
  sentQty: number            // qty yang benar-benar dikirim (bisa < requested)
  receivedQty: number        // qty yang dikonfirmasi diterima
}

interface StockOpname {
  id: string
  branchId: string           // opname di cabang mana
  opnameNumber: string       // "OPNAME-2025-01-001"
  status: 'draft' | 'in_progress' | 'completed' | 'approved'
  items: OpnameItem[]
  totalDiscrepancy: number
  estimatedLoss: number
  approvedBy: string | null
  createdBy: string
  createdAt: Date
  completedAt: Date | null
}

interface OpnameItem {
  productId: string
  productName: string
  systemStock: number
  physicalStock: number
  discrepancy: number
  discrepancyValue: number
}

// ─── POINT OF SALES ────────────────────────────────────────────

// Shift kasir — dibuka saat mulai kerja, ditutup saat selesai
interface CashierSession {
  id: string
  branchId: string
  cashierId: string
  cashierName: string
  status: 'open' | 'closed'
  openedAt: Date
  closedAt: Date | null
  openingCashBalance: number   // saldo awal yang disetor kasir
  expectedCashBalance: number  // dihitung sistem: opening + total tunai masuk - kembalian
  actualCashBalance: number    // dihitung fisik saat tutup shift
  cashDiscrepancy: number      // selisih: actual - expected
  totalSales: number           // total semua transaksi dalam shift ini
  totalCashSales: number
  totalCardSales: number
  totalTransferSales: number
  totalCreditSales: number     // penjualan piutang
  totalTransactions: number
  notes: string
}

// Keranjang aktif per kasir (multi-keranjang, max 5 per kasir)
interface PosCart {
  id: string
  branchId: string
  sessionId: string            // referensi ke CashierSession
  cashierId: string            // kasir yang membuka keranjang ini
  cartNumber: number           // 1–5, nomor slot keranjang
  customerName: string         // bisa diisi manual atau pilih dari master
  customerId: string | null
  items: CartItem[]
  discountPercent: number
  notes: string
  status: 'active' | 'hold' | 'paid' | 'cancelled'
  createdAt: Date
  updatedAt: Date
}

interface CartItem {
  productId: string
  productName: string
  sku: string
  unit: string
  qty: number
  sellingPrice: number
  discount: number
  subtotal: number
}

interface Customer {
  id: string
  name: string
  phone: string
  address: string
  type: 'retail' | 'credit'
  creditLimit: number
  outstandingDebt: number    // total piutang di semua cabang
  createdAt: Date
}

interface SalesTransaction {
  id: string
  tenantId: string
  branchId: string
  sessionId: string
  cartId: string
  transactionNumber: string
  customerId: string | null
  customerName: string
  items: SalesItem[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  grandTotal: number
  paymentMethod: 'cash' | 'card' | 'qris_edc' | 'qris_gopay' | 'qris_ovo' | 'qris_other' | 'transfer' | 'credit'
  // Untuk QRIS: kasir pilih sub-metode mana yang dipakai
  // Semua QRIS dikonfirmasi manual kasir setelah verifikasi sendiri (dengar bunyi / lihat EDC)
  qrisProvider: string | null   // "GoPay", "OVO", "EDC BCA", dll — diisi saat metode QRIS
  amountPaid: number
  change: number
  inputBy: string
  inputByName: string
  paidBy: string
  paidByName: string
  isCrossSession: boolean
  hasLegacyItems: boolean      // true jika ada item yang dijual dari legacyStock
  status: 'completed' | 'voided' | 'returned'
  notes: string
  createdAt: Date
}

interface SalesItem {
  productId: string
  productName: string
  sku: string
  unit: string
  qty: number
  purchasePrice: number
  sellingPrice: number
  discount: number
  subtotal: number
  stockSource: 'verified' | 'legacy' | 'unverified'
  // unverified = terjual saat legacyStock & stock keduanya 0 (masa onboarding)
}

// ─── SALES ORDER (PESANAN & INDENT) ───────────────────────────

interface SalesOrder {
  id: string
  branchId: string
  soNumber: string             // "SO-2025-01-0012"
  customerId: string
  customerName: string
  deliveryAddress: string      // alamat kirim ke klien
  items: SalesOrderItem[]
  subtotal: number
  discountAmount: number
  grandTotal: number
  downPayment: number          // uang muka yang sudah diterima
  remainingPayment: number     // sisa yang belum dibayar
  status: 'draft' | 'confirmed' | 'partial_delivered' | 'completed' | 'cancelled'
  paymentStatus: 'unpaid' | 'partial' | 'paid'
  estimatedDeliveryDate: Date
  notes: string
  createdBy: string
  createdAt: Date
  completedAt: Date | null
}

interface SalesOrderItem {
  id: string
  soId: string
  productId: string
  productName: string
  sku: string
  unit: string
  qty: number                  // total qty yang dipesan klien
  sellingPrice: number
  discount: number
  subtotal: number
  // Rencana pemenuhan — bisa split antara stok toko dan indent
  fulfillments: SoFulfillment[]
  deliveredQty: number         // sudah terkirim ke klien
  status: 'pending' | 'partial' | 'fulfilled'
}

interface SoFulfillment {
  source: 'stock' | 'indent'   // dari stok toko atau indent supplier
  qty: number
  purchaseOrderId: string | null // jika indent, referensi ke PO
  supplierId: string | null      // jika indent, supplier mana
  purchasePriceAtTime: number    // HPP saat SO dibuat (untuk hitung margin)
  status: 'planned' | 'in_progress' | 'delivered'
}

// ─── KEUANGAN ──────────────────────────────────────────────────

interface CashAccount {
  id: string
  branchId: string           // kas milik cabang mana
  name: string
  type: 'cash' | 'bank'
  accountNumber: string | null
  balance: number
  isActive: boolean
}

interface CashTransaction {
  id: string
  branchId: string
  cashAccountId: string
  type: 'income' | 'expense' | 'transfer'
  category: string
  amount: number
  reference: string
  description: string
  userId: string
  createdAt: Date
}

// ─── HUTANG & PIUTANG ──────────────────────────────────────────

interface AccountReceivable {
  id: string
  branchId: string           // piutang timbul dari cabang mana
  invoiceNumber: string
  customerId: string
  customerName: string
  salesTransactionId: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  dueDate: Date
  status: 'unpaid' | 'partial' | 'paid' | 'overdue'
  payments: ArPayment[]
  createdAt: Date
}

interface ArPayment {
  id: string
  arId: string
  amount: number
  paymentDate: Date
  paymentMethod: 'cash' | 'transfer'
  notes: string
  userId: string
}

interface AccountPayable {
  id: string
  branchId: string           // hutang timbul dari PO cabang mana
  invoiceNumber: string
  supplierId: string
  supplierName: string
  purchaseOrderId: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  dueDate: Date
  status: 'unpaid' | 'partial' | 'paid' | 'overdue'
  payments: ApPayment[]
  createdAt: Date
}

interface ApPayment {
  id: string
  apId: string
  amount: number
  cashAccountId: string
  paymentDate: Date
  notes: string
  userId: string
}

// ─── PEMBELIAN ─────────────────────────────────────────────────

interface Supplier {
  id: string
  name: string
  contactPerson: string
  phone: string
  address: string
  email: string
  paymentTerms: number
  outstandingDebt: number    // total hutang di semua cabang
  isActive: boolean
}

interface PurchaseOrder {
  id: string
  branchId: string
  poNumber: string
  type: 'regular' | 'indent'  // regular = ke gudang toko; indent = langsung ke klien
  salesOrderId: string | null  // diisi jika type = 'indent', referensi SO
  supplierId: string
  supplierName: string
  deliveryAddress: string      // alamat gudang toko (regular) atau alamat klien (indent)
  items: PoItem[]
  subtotal: number
  grandTotal: number
  status: 'draft' | 'sent' | 'partial_received' | 'received' | 'cancelled'
  expectedDate: Date
  notes: string
  createdBy: string
  createdAt: Date
}

interface PoItem {
  productId: string
  productName: string
  sku: string
  unit: string
  orderedQty: number
  receivedQty: number
  purchasePrice: number
  subtotal: number
}

interface GoodsReceipt {
  id: string
  branchId: string
  grNumber: string
  purchaseOrderId: string
  supplierId: string
  items: GrItem[]
  totalItems: number
  receivedBy: string
  receivedAt: Date
  notes: string
}

interface GrItem {
  productId: string
  productName: string
  orderedQty: number
  receivedQty: number
  unit: string
}

// ─── LAPORAN ───────────────────────────────────────────────────

// DashboardSummary bisa untuk satu cabang atau konsolidasi semua cabang
interface DashboardSummary {
  branchId: string | 'all'   // 'all' = konsolidasi
  todaySales: number
  todayTransactions: number
  lowStockCount: number
  totalAR: number
  totalAP: number
  overdueAR: number
  overdueAP: number
  cashBalance: number
  monthlyRevenue: number
  monthlyExpense: number
  monthlyGrossProfit: number
  monthlyNetProfit: number
  // Hanya ada di mode konsolidasi (branchId = 'all')
  branchSummaries?: BranchKpi[]
}

interface BranchKpi {
  branchId: string
  branchName: string
  todaySales: number
  todayTransactions: number
  lowStockCount: number
  monthlyRevenue: number
  monthlyNetProfit: number
}

interface SalesReport {
  branchId: string | 'all'
  period: { start: Date; end: Date }
  totalRevenue: number
  totalCOGS: number
  grossProfit: number
  grossMargin: number
  totalTransactions: number
  averageTransactionValue: number
  byDay: { date: Date; revenue: number; transactions: number }[]
  topProducts: { productId: string; name: string; qty: number; revenue: number }[]
  byCashier: { userId: string; name: string; transactions: number; revenue: number }[]
  // Hanya ada di mode konsolidasi
  byBranch?: { branchId: string; branchName: string; revenue: number; transactions: number }[]
}
```

---

## Implementation Details

- **Tech Stack Frontend:** Vite + React + TypeScript + Tailwind CSS
- **Tech Stack Backend:** Laravel (REST API) + PostgreSQL (database)
- **Routing:** React Router v6 (nested routes per modul)
- **Icons:** Lucide React
- **Components:** shadcn/ui (Radix-based)
- **Animations:** Framer Motion
- **Charts:** Recharts
- **Date Utils:** date-fns (locale `id`)
- **State Management:** Zustand (global state per modul + offline transaction queue)
- **Form Handling:** React Hook Form + Zod (validasi)
- **Table:** TanStack Table v8 (sorting, filtering, pagination)
- **Export:** jsPDF + xlsx untuk export laporan
- **Data:** Mock statis (no backend/API) — struktur siap untuk koneksi ke Laravel REST API

---

### PWA & Offline-First Architecture

SES dirancang sebagai **Progressive Web App (PWA)** dengan kemampuan offline penuh di modul kasir — memastikan transaksi tidak terhenti saat internet putus atau listrik padam.

#### Lapisan Offline

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — PWA Shell (Service Worker)                               │
│  App shell, aset statis, dan halaman kasir di-cache oleh SW         │
│  → Aplikasi bisa dibuka & diinstal tanpa internet                   │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 2 — Local Data Cache (IndexedDB)                             │
│  Master Produk + Harga, Data Pelanggan + Credit Limit,              │
│  Konfigurasi Toko + Cabang, Data Shift Kasir Aktif                  │
│  → Kasir bisa cari produk & transaksi tanpa koneksi                 │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 3 — Transaction Queue (Zustand + localStorage)               │
│  Setiap transaksi saat offline disimpan ke queue lokal              │
│  → Tidak ada transaksi yang hilang                                  │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 4 — Background Sync (saat online kembali)                    │
│  Service Worker Background Sync API (Chrome/Android) +              │
│  Manual trigger "Sinkronkan Sekarang" (fallback iOS Safari)         │
│  → Semua queue dikirim ke Laravel backend via bulk-insert           │
└─────────────────────────────────────────────────────────────────────┘
```

#### Implementasi Teknis

**Service Worker & PWA:**
```
// vite-plugin-pwa — konfigurasi di vite.config.ts
// Cache strategy:
//   - App shell → Cache First (stale-while-revalidate)
//   - API master data → Network First, fallback ke IndexedDB
//   - Transaksi → Queue (Background Sync)
```

**IndexedDB — Stores yang Di-cache Lokal:**
```typescript
// Refresh otomatis setiap login / saat online / setiap 6 jam
const IDB_STORES = {
  products:      'Master produk + harga per cabang (BranchProduct)',
  customers:     'Data pelanggan + credit limit + outstanding debt',
  branchConfig:  'Konfigurasi cabang aktif (shift, metode bayar)',
  activeSession: 'Data shift kasir yang sedang berjalan',
  txQueue:       'Antrean transaksi offline yang belum tersinkron',
}
```

**Transaction Queue (Zustand):**
```typescript
interface OfflineTxQueue {
  items: QueuedTransaction[]
  status: 'idle' | 'syncing' | 'error'
  lastSyncAt: Date | null
  pendingCount: number
}

interface QueuedTransaction {
  localId: string           // UUID lokal, diganti server ID setelah sync
  tenantId: string
  branchId: string
  sessionId: string
  payload: SalesTransaction // payload lengkap, siap dikirim ke API
  createdOfflineAt: Date
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed'
  retryCount: number
}
```

**Background Sync:**
```
navigator.onLine === false → transaksi masuk txQueue (IndexedDB)
navigator.onLine === true  →
  1. Service Worker Background Sync API menembak (Chrome/Android)
  2. ATAU user klik "Sinkronkan Sekarang" (manual fallback iOS)
  3. Frontend kirim POST /api/transactions/bulk ke Laravel
  4. Laravel proses rekonsiliasi per transaksi
  5. Response: { synced: [], failed: [], flagged: [] }
  6. Queue item synced dihapus, failed diberi status error + retry
```

---

## SOP & Business Logic — Skenario Offline

### Deteksi Status Koneksi & UI Indicator

Sistem memantau `navigator.onLine` secara real-time. Saat offline terdeteksi, seluruh UI kasir menampilkan indikator persisten:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 👤 Andi  📍 Sudirman  💼 Shift: 08:00                                   │
│ ⚠️  OFFLINE MODE — Transaksi tersimpan lokal, akan disinkron otomatis    │
│     3 transaksi menunggu sinkronisasi   [🔄 Sinkronkan Sekarang]         │
├──────────────────────────────────────────────────────────────────────────┤
│ ... (UI kasir tetap berfungsi normal) ...                                │
└──────────────────────────────────────────────────────────────────────────┘
```

| Status Koneksi | Warna Indikator | Perilaku Sistem |
|---------------|-----------------|-----------------|
| 🟢 Online | Hijau (tersembunyi) | Normal — semua fitur aktif |
| 🟡 Reconnecting | Kuning — pulsing | Mencoba sync queue yang pending |
| 🔴 Offline | Merah — persistent banner | Mode offline aktif |

---

### Kapabilitas & Batasan Saat Offline

**Yang TETAP BISA dilakukan saat offline:**

| Fitur | Sumber Data | Keterangan |
|-------|-------------|------------|
| Cari & tambah produk ke keranjang | IndexedDB cache | Harga dari cache terakhir |
| Proses transaksi (checkout) | Queue lokal | Disimpan ke txQueue |
| Cetak struk | Bluetooth printer | Tidak bergantung jaringan |
| Lihat shift & riwayat transaksi hari ini | IndexedDB cache | Data sebelum offline |
| Hold & resume keranjang | Zustand + localStorage | Tidak perlu server |

**Yang TIDAK BISA dilakukan saat offline:**

| Fitur | Alasan |
|-------|--------|
| Cek stok real-time (angka pasti) | Data stok butuh server |
| Validasi credit limit piutang real-time | Butuh data AR terkini dari server |
| Buka SO baru dari portal customer | Butuh koneksi server |
| Sinkronisasi harga yang baru diupdate | Butuh fetch dari server |
| Login user baru (belum pernah login) | Session butuh server |

---

### Force Checkout — Saat Offline

Saat offline, validasi stok dan limit piutang **dinonaktifkan sementara**. Kasir tetap bisa checkout:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️  Checkout Offline                                               │
│  ─────────────────────────────────────────────────────────────────  │
│  Kamu sedang offline. Transaksi ini akan disimpan sementara         │
│  dan dikirim ke server saat koneksi kembali.                        │
│                                                                     │
│  Yang tidak bisa divalidasi saat ini:                               │
│  • Stok real-time (mungkin sudah berubah di kasir lain)             │
│  • Limit piutang customer (data mungkin belum terbaru)              │
│                                                                     │
│  Transaksi tetap sah dan akan direkonsiliasi otomatis.              │
│                                                                     │
│  [Batal]              [✅ Lanjutkan Checkout Offline]               │
└─────────────────────────────────────────────────────────────────────┘
```

Setiap transaksi offline diberi flag:
```typescript
{
  isOfflineTransaction: true,
  offlineCreatedAt: Date,
  syncStatus: 'pending',
  // stok dan limit piutang tidak divalidasi — perlu rekonsiliasi server
}
```

---

### Rekonsiliasi Backend (Laravel) Setelah Sync

Saat queue dikirim ke Laravel via `POST /api/transactions/bulk`, backend melakukan rekonsiliasi per transaksi dalam urutan `offlineCreatedAt`:

```
UNTUK SETIAP transaksi dalam queue:

1. Cek stok di database
   → Stok cukup → proses normal, kurangi stok
   → Stok kurang → kurangi stok (bisa minus), flag sebagai STOCK_DEFICIT

2. Jika metode bayar = Piutang:
   Cek credit limit customer saat ini
   → Limit cukup → proses normal
   → Limit terlampaui → proses (jangan batalkan), flag sebagai CREDIT_EXCEEDED

3. Catat ke transaction log dengan field:
   reconciledAt, reconciledBy: 'system', offlineFlags: []

Response ke frontend:
{
  synced: ['localId-1', 'localId-2'],   // berhasil
  flagged: [
    {
      localId: 'localId-3',
      flags: ['STOCK_DEFICIT'],
      serverTxId: 'TRX-2025-01-0089',
      detail: 'Semen Portland 50kg: dipesan 10, stok tersisa 3'
    }
  ],
  failed: []  // error teknis, perlu retry
}
```

**Dashboard Manager — Flagging Pasca Rekonsiliasi:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ ⚠️  Peringatan Rekonsiliasi Offline          15 Jan 2025, 14:32       │
│ ─────────────────────────────────────────────────────────────────────  │
│ 3 transaksi offline telah tersinkron dengan peringatan:               │
│                                                                        │
│ 🔴 STOCK_DEFICIT                                                       │
│    TRX-0089 — Andi — Semen Portland 50kg × 10                         │
│    Stok saat sync hanya 3 sak. Stok kini: -7 sak                      │
│    [Stock Adjustment]                                                  │
│                                                                        │
│ 🟡 CREDIT_EXCEEDED                                                     │
│    TRX-0091 — Andi — PT Abadi Jaya — Rp 5.500.000                    │
│    Limit Rp 50jt, total outstanding kini Rp 53.200.000               │
│    [Lihat AR Customer]                                                 │
│                                                                        │
│ [Tandai Sudah Ditangani]                                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Hardware & Infrastructure Requirements

Rekomendasi minimum perangkat keras per toko/cabang untuk memastikan SES berjalan optimal, termasuk saat listrik padam atau koneksi internet terputus.

### Network Failover — Dual-WAN Router

```
┌──────────────────────────────────────────────────────────────────────┐
│                        JARINGAN TOKO                                 │
│                                                                      │
│  ISP Utama (kabel)                  Backup 4G/5G                    │
│  Indihome / Biznet / dll            Modem seluler (Telkomsel/XL)    │
│         │                                    │                       │
│         └──────────────┬───────────────────-─┘                       │
│                        │                                             │
│              ┌─────────▼──────────┐                                  │
│              │   DUAL-WAN ROUTER  │  ← mini-UPS (tetap nyala        │
│              │   (TP-Link ER605   │    saat mati listrik)            │
│              │    atau setara)     │                                  │
│              └─────────┬──────────┘                                  │
│                        │                                             │
│              Switch / Access Point                                   │
│                        │                                             │
│         ┌──────────────┼──────────────┐                              │
│         │              │              │                              │
│   PC Kasir 1     PC Kasir 2     Tablet/HP                           │
└──────────────────────────────────────────────────────────────────────┘
```

**Spesifikasi minimum:**

| Komponen | Spesifikasi | Tujuan |
|----------|------------|--------|
| Router | Dual-WAN, auto failover (misal TP-Link ER605) | Otomatis switch ke 4G jika ISP utama mati |
| ISP Utama | Fiber/kabel min. 10 Mbps | Koneksi stabil sehari-hari |
| Modem 4G/5G | SIM card data aktif (Telkomsel/XL) | Backup otomatis saat ISP mati |
| Mini-UPS Router | Kapasitas min. 4 jam | Router tetap nyala saat PLN mati |
| Mini-UPS PC Kasir | Kapasitas min. 1 jam | Cukup untuk selesaikan & simpan transaksi berjalan |

**Konfigurasi failover:** Router mendeteksi ISP utama mati → otomatis routing via 4G dalam < 30 detik → kasir tidak merasakan gangguan (offline transaction queue menangani gap tersebut jika ada).

---

### Offline Printing — Bluetooth Thermal Printer

Printer struk **tidak boleh** menggunakan printer LAN atau USB yang bergantung pada server/listrik PLN. Wajib menggunakan **Bluetooth Thermal Printer dengan baterai internal**.

| Kriteria | Spesifikasi |
|----------|------------|
| Konektivitas | Bluetooth (utama) + USB (cadangan) |
| Baterai | Built-in, kapasitas min. 6 jam operasional |
| Lebar kertas | 58mm atau 80mm (standar struk kasir) |
| Kompatibilitas | ESC/POS command standard |
| Contoh perangkat | Rongta RPP02N, EPSON TM-P20, atau setara |

**Integrasi di SES:**
- Printer terhubung via Web Bluetooth API (Chrome/Android) atau driver native
- Saat online: struk dikirim langsung dari browser ke printer via Bluetooth
- Saat offline: struk di-generate dari data transaksi lokal (IndexedDB) → dikirim ke printer via Bluetooth — **tidak butuh server sama sekali**
- Format struk identik online maupun offline; transaksi offline diberi keterangan kecil: `[OFFLINE - Pending Sync]` yang hilang setelah tersinkron

---

### Tabel Skenario & Mitigasi

| Skenario | Dampak Tanpa Mitigasi | Solusi di SES |
|----------|-----------------------|---------------|
| Internet putus (ISP mati) | POS tidak bisa digunakan | Dual-WAN failover ke 4G + offline mode |
| 4G dan ISP keduanya mati | POS tidak bisa digunakan | Offline mode penuh — transaksi ke queue lokal |
| Listrik PLN mati | Semua perangkat mati | Mini-UPS router + Mini-UPS kasir + BT printer berbaterai |
| Server SES down (maintenance) | POS tidak bisa digunakan | Offline mode + queue — toko tetap beroperasi |
| Stok konflik pasca offline | Data stok tidak akurat | Flagging di dashboard manager + Stock Adjustment |
| Credit limit terlampaui offline | Piutang melebihi limit | Flagging CREDIT_EXCEEDED + notif ke manager |

---

## Styling & Theming

### Visual Identity

- **Aesthetic:** Enterprise-grade, trustworthy, data-dense tapi tetap bersih
- **Brand Color:** `blue-700` (kepercayaan, profesionalisme)
- **Dark Mode:** Slate-based dark palette (`slate-900`, `slate-800`, `slate-700`)
- **Light Mode:** White + Slate-50 background

### Color Palette

| Konteks | Warna | Token |
|---------|-------|-------|
| Primary / Brand | Biru | `blue-700` |
| Modul POS | Hijau | `green-600` |
| Modul Inventory | Cyan | `cyan-600` |
| Modul Keuangan | Emerald | `emerald-600` |
| Modul Hutang/Piutang | Amber | `amber-600` |
| Modul Pembelian | Orange | `orange-600` |
| Modul Laporan | Violet | `violet-600` |
| Danger / Overdue | Merah | `red-500` |
| Warning / Kritis | Kuning | `yellow-500` |
| Sukses / Lunas | Hijau | `green-500` |

### Typography

- **Font:** Inter (Google Fonts)
- **Heading modul:** `text-xl font-semibold`
- **Label tabel:** `text-sm font-medium text-slate-600`
- **Angka/nominal:** `font-mono tabular-nums` (agar angka sejajar di tabel)
- **Nominal besar:** `text-2xl font-bold`
- **Struk/receipt:** `font-mono text-xs`

### Spacing & Layout

- **Container:** `max-w-full px-4 lg:px-6`
- **Card KPI:** `rounded-xl border p-4 shadow-sm`
- **Tabel:** `rounded-lg border shadow-sm overflow-hidden`
- **Sidebar lebar:** `w-56` (desktop), collapsed `w-12` (mobile)
- **Tombol aksi utama:** `min-h-[44px]` (touch-friendly)
- **Responsive breakpoints:** `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`

---

## UI Components Specification

### KPI Card
```
┌──────────────────────────────┐
│ 💰 Total Penjualan Hari Ini  │
│ Rp 4.500.000                 │
│ ↑ +12.5% vs kemarin          │
│ 47 transaksi                 │
└──────────────────────────────┘
```
- Icon + label di atas
- Nominal besar di tengah
- Badge persentase (hijau = naik, merah = turun)
- Sub-info di bawah (opsional)

### Notifikasi Stok Kritis (Badge)
```
🔴 Stok Kritis (8)
   ├── Semen Portland 50kg — sisa 3 sak (min: 20)
   ├── Cat Tembok Putih 5kg — sisa 2 kaleng (min: 10)
   └── ... dan 6 lainnya
```
- Klik → redirect ke modul Inventory, filter stok kritis
- Badge merah di top navigation

### Status Badge (Konsisten Lintas Modul)
```
🟢 Lunas         🟡 Sebagian     🔴 Belum Bayar
🟢 Tersedia      🟡 Menipis      🔴 Habis
🟢 Selesai       🟡 Diproses     🔴 Dibatalkan
🟢 Diterima      🟡 Sebagian     🔴 Belum Terima
```

### Data Table (Standar)
```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔍 Cari...         Filter: [Semua ▼]  [Periode ▼]    [+ Tambah]     │
│ ──────────────────────────────────────────────────────────────────── │
│ ☐  Col A    Col B      Col C       Col D      Aksi                   │
│ ☐  Data 1   Data 2     Data 3      Data 4     [👁] [✏️] [🗑]         │
│ ☐  Data 5   Data 6     Data 7      Data 8     [👁] [✏️] [🗑]         │
│ ──────────────────────────────────────────────────────────────────── │
│ Menampilkan 1-10 dari 247 data    [< 1 2 3 ... 25 >]  [10 per hal ▼]│
└──────────────────────────────────────────────────────────────────────┘
```
- Checkbox untuk bulk action
- Sort per kolom (klik header)
- Pagination + pilihan item per halaman
- Aksi: Lihat Detail, Edit, Hapus (sesuai permission role)

### Struk / Receipt POS
```
┌──────────────────────────────┐
│   SIMETRI ERP STORE          │
│ Jl. Merdeka No. 1, Jakarta   │
│ Telp: 021-1234567            │
│                              │
│ No: TRX-2025-01-0001         │
│ Kasir: Andi                  │
│ 15/01/2025  09:45            │
│ ───────────────────────────  │
│ Semen Port. 50kg 2x  130.000 │
│ Cat Tembok 5kg  1x    45.000 │
│ Pipa PVC 3/4"  5x    22.000  │
│ ───────────────────────────  │
│ Subtotal           197.000   │
│ Diskon (5%)         -9.850   │
│ Total              187.150   │
│ Tunai              200.000   │
│ Kembalian           12.850   │
│ ───────────────────────────  │
│ Terima kasih!                │
└──────────────────────────────┘
```

### Modal Konfirmasi (Standar)
Setiap aksi destruktif (void transaksi, hapus data, adjust stok) memunculkan modal konfirmasi dua langkah:
```
┌────────────────────────────────────────────┐
│ ⚠️  Konfirmasi Void Transaksi              │
│                                            │
│ Anda akan membatalkan transaksi            │
│ TRX-2025-01-0001 senilai Rp 187.150        │
│                                            │
│ Tindakan ini akan:                         │
│ • Mengembalikan stok 3 produk              │
│ • Membatalkan pencatatan kas               │
│ • Tidak dapat dibatalkan                   │
│                                            │
│ Alasan: [________________________]         │
│                                            │
│ [Batal]              [Ya, Void Transaksi]  │
└────────────────────────────────────────────┘
```

---

## Interactions & States

### Role-Based Access Control (RBAC)

**Dimensi akses: Role + Cabang**

| Fitur | Owner | Manajer | Kasir | Gudang | Akuntan |
|-------|-------|---------|-------|--------|---------|
| Pilih cabang (Branch Switcher) | ✅ Semua | ✅ Cabang ditugaskan | ❌ | ❌ | ❌ |
| Mode konsolidasi "Semua Cabang" | ✅ | ❌ | ❌ | ❌ | ❌ |
| Tambah / nonaktifkan cabang | ✅ | ❌ | ❌ | ❌ | ❌ |
| Tugaskan manager ke cabang | ✅ | ❌ | ❌ | ❌ | ❌ |
| Dashboard penuh | ✅ | ✅ cabang-nya | ❌ | ❌ | ✅ cabang-nya |
| Buka / tutup shift kasir | ✅ | ✅ | ✅ shift-nya | ❌ | ❌ |
| Lihat semua shift hari ini | ✅ | ✅ cabang-nya | ❌ | ❌ | ✅ cabang-nya |
| POS — input keranjang | ✅ | ✅ | ✅ | ❌ | ❌ |
| POS — proses pembayaran | ✅ | ✅ | ✅ | ❌ | ❌ |
| POS — ambil alih keranjang kasir lain | ✅ | ✅ | ✅ | ❌ | ❌ |
| Void transaksi | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lihat harga beli (HPP) | ✅ | ✅ | ❌ | ✅ | ✅ |
| Edit HPP (harga beli) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit harga jual per cabang | ✅ | ✅ cabang-nya | ❌ | ❌ | ❌ |
| Stock opname | ✅ | ✅ | ❌ | ✅ | ❌ |
| Approve stock opname | ✅ | ✅ | ❌ | ❌ | ❌ |
| Buat Transfer Stok | ✅ | ✅ | ❌ | ✅ | ❌ |
| Konfirmasi Terima Transfer Stok | ✅ | ✅ | ❌ | ✅ | ❌ |
| Buat PO | ✅ | ✅ | ❌ | ✅ | ❌ |
| Approve PO | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lihat laporan keuangan | ✅ | ✅ cabang-nya | ❌ | ❌ | ✅ cabang-nya |
| Laporan audit shift kasir | ✅ | ✅ cabang-nya | ❌ | ❌ | ✅ cabang-nya |
| Laporan konsolidasi semua cabang | ✅ | ❌ | ❌ | ❌ | ❌ |
| Kelola user | ✅ | ❌ | ❌ | ❌ | ❌ |

> **Catatan:** "cabang-nya" berarti akses terbatas hanya pada cabang yang ditugaskan ke user tersebut.

### Notifikasi Sistem (Otomatis)

| Trigger | Penerima | Scope | Prioritas |
|---------|----------|-------|-----------|
| Stok ≤ reorder point | Owner, Manajer, Gudang | Cabang terkait | 🔴 Merah |
| Transfer stok masuk menunggu konfirmasi | Manajer & Gudang cabang tujuan | Cabang tujuan | 🔵 Biru |
| Selisih kas shift kasir ≠ 0 | Owner, Manajer | Cabang terkait | 🔴 Merah |
| Kasir belum tutup shift (> 12 jam) | Owner, Manajer | Cabang terkait | 🟡 Kuning |
| Piutang jatuh tempo H-3 | Owner, Manajer, Akuntan | Cabang terkait | 🟡 Kuning |
| Piutang sudah jatuh tempo | Owner, Manajer, Akuntan | Cabang terkait | 🔴 Merah |
| Hutang jatuh tempo H-3 | Owner, Manajer, Akuntan | Cabang terkait | 🟡 Kuning |
| Hutang sudah jatuh tempo | Owner, Manajer, Akuntan | Cabang terkait | 🔴 Merah |
| Stock opname menunggu approval | Owner, Manajer | Cabang terkait | 🟡 Kuning |
| PO menunggu approval | Owner, Manajer | Cabang terkait | 🟡 Kuning |

> Notifikasi selalu mencantumkan nama cabang terkait (misal: "🔴 Stok Kritis — Cabang Bekasi: Semen Portland tersisa 3 sak")

### Animasi & Transisi

- **Perpindahan modul:** fade + slide (150ms ease)
- **KPI card:** count-up animation saat load (angka naik dari 0)
- **POS add to cart:** produk mini "terbang" ke keranjang
- **Notifikasi:** slide-in dari kanan atas, auto-dismiss 5 detik
- **Table row hover:** `bg-slate-50` / `bg-slate-800` highlight
- **Modal:** scale + fade (100ms)
- **Toast success/error:** slide dari bawah

### Empty States (Per Modul)

| Modul | Pesan Kosong |
|-------|-------------|
| Inventory | "Belum ada produk. Tambahkan produk di menu Master Barang." |
| POS Cart | "Belum ada item. Pilih produk dari katalog." |
| Piutang | "Tidak ada piutang aktif. Semua pembayaran sudah lunas! 🎉" |
| Hutang | "Tidak ada hutang aktif." |
| Laporan | "Pilih periode untuk menampilkan laporan." |
| PO | "Belum ada Purchase Order. Buat PO pertama Anda." |
| Transfer Stok | "Tidak ada transfer stok aktif." |
| Notifikasi | "Tidak ada notifikasi baru. Semua berjalan lancar! ✅" |
| Dashboard Konsolidasi | "Belum ada cabang aktif. Tambahkan cabang di menu Pengaturan." |

---

## Language & Localization

- **Bahasa UI:** Bahasa Indonesia
- **Format tanggal:** `DD/MM/YYYY` (misal: 15/01/2025)
- **Format jam:** 24 jam (misal: 14:30)
- **Format angka:** Titik sebagai pemisah ribuan (misal: Rp 1.250.000)
- **Format desimal:** Koma (misal: 12,5%)
- **Modul:** "Dashboard", "Kasir", "Inventori", "Keuangan", "Hutang & Piutang", "Pembelian", "Laporan"
- **Aksi umum:** "Tambah", "Edit", "Hapus", "Simpan", "Batal", "Konfirmasi", "Ekspor", "Cetak"
- **Status umum:** "Aktif", "Nonaktif", "Lunas", "Belum Bayar", "Sebagian", "Terlambat"

---

## Example Mock Data

```typescript
const mockCompany: SesCompany = {
  id: 'comp-1',
  name: 'Toko Bangunan Simetri',
  address: 'Jl. Sudirman No. 45, Jakarta Pusat',
  phone: '021-5551234',
  taxId: '01.234.567.8-901.000',
  logo: null,
  currency: 'IDR',
  fiscalYearStart: 1,
}

// ─── CABANG ────────────────────────────────────────────────────

const mockBranches: Branch[] = [
  { id: 'cbg-1', code: 'CBG-001', name: 'Cabang Sudirman', address: 'Jl. Sudirman No. 45, Jakarta', phone: '021-5551234', managerId: 'u-2', isActive: true, createdAt: new Date('2024-01-01') },
  { id: 'cbg-2', code: 'CBG-002', name: 'Cabang Kebon Jeruk', address: 'Jl. Kebon Jeruk No. 12, Jakarta Barat', phone: '021-5556789', managerId: 'u-5', isActive: true, createdAt: new Date('2024-03-01') },
  { id: 'cbg-3', code: 'CBG-003', name: 'Cabang Bekasi', address: 'Jl. Ahmad Yani No. 88, Bekasi', phone: '021-5559012', managerId: 'u-6', isActive: true, createdAt: new Date('2024-06-01') },
]

// ─── TENANT ────────────────────────────────────────────────────

const mockTenants: Tenant[] = [
  {
    id: 'ten-001',
    name: 'Toko Bangunan Simetri',
    slug: 'toko-simetri',
    ownerEmail: 'budi@simetri.id',
    phone: '021-5551234',
    plan: 'pro',
    trialEndsAt: null,
    onboardingStatus: {
      jalur: 'excel_import',
      completedSteps: ['store_info', 'branch', 'users', 'products', 'stock'],
      totalProducts: 312,
      productsWithStock: 312,
      isOnboardingComplete: true,
      completedAt: new Date('2024-01-03'),
      legacyModeActive: false,
    },
    isActive: true,
    createdAt: new Date('2024-01-01'),
  },
  // Contoh toko kedua — masih dalam onboarding (jalur B: tidak ada catatan)
  {
    id: 'ten-002',
    name: 'Toko Maju Jaya',
    slug: 'maju-jaya',
    ownerEmail: 'hendra@majujaya.id',
    phone: '0812-9999-1234',
    plan: 'trial',
    trialEndsAt: new Date('2025-02-15'),
    onboardingStatus: {
      jalur: 'no_records',
      completedSteps: ['store_info', 'branch', 'users', 'products'],
      totalProducts: 87,
      productsWithStock: 34,         // baru 34 dari 87 yang sudah diisi stok
      isOnboardingComplete: false,
      completedAt: null,
      legacyModeActive: true,        // masih aktif — transaksi diizinkan meski stok belum lengkap
    },
    isActive: true,
    createdAt: new Date('2025-01-20'),
  },
]

// ─── USER (dengan tenantId) ─────────────────────────────────────

const mockUsers: SesUser[] = [
  { id: 'u-1', tenantId: 'ten-001', name: 'Budi Santoso', email: 'budi@simetri.id', role: 'owner', pin: '000000', branchIds: [], isActive: true, createdAt: new Date('2024-01-01') },
  { id: 'u-2', tenantId: 'ten-001', name: 'Siti Rahma', email: 'siti@simetri.id', role: 'manager', pin: '111111', branchIds: ['cbg-1', 'cbg-2'], isActive: true, createdAt: new Date('2024-01-15') },
  { id: 'u-5', tenantId: 'ten-001', name: 'Rudi Hermawan', email: 'rudi@simetri.id', role: 'manager', pin: '555555', branchIds: ['cbg-2', 'cbg-3'], isActive: true, createdAt: new Date('2024-03-01') },
  { id: 'u-6', tenantId: 'ten-001', name: 'Hana Wijaya', email: 'hana@simetri.id', role: 'manager', pin: '666666', branchIds: ['cbg-3'], isActive: true, createdAt: new Date('2024-06-01') },
  { id: 'u-3', tenantId: 'ten-001', name: 'Andi Pratama', email: 'andi@simetri.id', role: 'cashier', pin: '222222', branchIds: ['cbg-1'], isActive: true, createdAt: new Date('2024-02-01') },
  { id: 'u-4', tenantId: 'ten-001', name: 'Dewi Lestari', email: 'dewi@simetri.id', role: 'warehouse', pin: '333333', branchIds: ['cbg-1'], isActive: true, createdAt: new Date('2024-02-01') },
  { id: 'u-7', tenantId: 'ten-001', name: 'Fajar Nugroho', email: 'fajar@simetri.id', role: 'accountant', pin: '777777', branchIds: ['cbg-1'], isActive: true, createdAt: new Date('2024-02-01') },
]

// ─── PRODUK (dengan tenantId & barcode nullable) ────────────────

const mockProducts: Product[] = [
  { id: 'p-1', tenantId: 'ten-001', sku: 'BRG-001', barcode: '8991001000001', name: 'Semen Portland 50kg', categoryId: 'cat-1', unit: 'sak', purchasePrice: 57000, libraryProductId: 'lib-001', isActive: true, lastUpdated: new Date() },
  { id: 'p-2', tenantId: 'ten-001', sku: 'BRG-002', barcode: '8991001000002', name: 'Bata Merah', categoryId: 'cat-2', unit: 'pcs', purchasePrice: 800, libraryProductId: 'lib-002', isActive: true, lastUpdated: new Date() },
  { id: 'p-3', tenantId: 'ten-001', sku: 'BRG-003', barcode: null, name: 'Cat Tembok Putih 5kg (Stok Lama)', categoryId: 'cat-3', unit: 'kaleng', purchasePrice: 38000, libraryProductId: null, isActive: true, lastUpdated: new Date() },
  // ↑ barcode: null = stok lama belum tempel barcode
]

// ─── STOK PER CABANG (dengan legacyStock) ──────────────────────

const mockBranchProducts: BranchProduct[] = [
  // Cabang Sudirman
  // stock=80 verified (dari GR berbarcode) + legacyStock=0 (sudah habis terjual)
  { id: 'bp-1', tenantId: 'ten-001', branchId: 'cbg-1', productId: 'p-1', sellingPrice: 65000, stock: 80, legacyStock: 0, reorderPoint: 20, warehouseLocation: 'A-01' },
  { id: 'bp-2', tenantId: 'ten-001', branchId: 'cbg-1', productId: 'p-2', sellingPrice: 1100, stock: 1200, legacyStock: 0, reorderPoint: 500, warehouseLocation: 'B-01' },
  // stock=0 + legacyStock=3 → masih ada stok lama, belum ada stok baru masuk
  { id: 'bp-3', tenantId: 'ten-001', branchId: 'cbg-1', productId: 'p-3', sellingPrice: 45000, stock: 0, legacyStock: 3, reorderPoint: 10, warehouseLocation: 'C-02' },

  // Cabang Kebon Jeruk
  { id: 'bp-4', tenantId: 'ten-001', branchId: 'cbg-2', productId: 'p-1', sellingPrice: 66000, stock: 45, legacyStock: 0, reorderPoint: 15, warehouseLocation: 'A-01' },
  { id: 'bp-5', tenantId: 'ten-001', branchId: 'cbg-2', productId: 'p-3', sellingPrice: 46000, stock: 5, legacyStock: 10, reorderPoint: 10, warehouseLocation: 'B-03' },
  // ↑ masih campuran: 5 stok baru (berbarcode) + 10 stok lama (belum barcode)

  // Cabang Bekasi
  { id: 'bp-6', tenantId: 'ten-001', branchId: 'cbg-3', productId: 'p-1', sellingPrice: 64000, stock: 120, legacyStock: 0, reorderPoint: 30, warehouseLocation: 'A-01' },
  { id: 'bp-7', tenantId: 'ten-001', branchId: 'cbg-3', productId: 'p-4', sellingPrice: 22000, stock: 8, legacyStock: 0, reorderPoint: 20, warehouseLocation: 'D-01' },
]

// ─── CUSTOMER PORTAL ───────────────────────────────────────────

const mockPortalConfig: CustomerPortalConfig = {
  tenantId: 'ten-001',
  isActive: true,
  slug: 'toko-simetri',
  customDomain: null,
  whatsappNumber: '6281234567890',
  welcomeMessage: 'Selamat datang di portal order online Toko Bangunan Simetri!',
  allowGuestBrowse: true,
  paymentMethods: {
    transfer: {
      enabled: true,
      bankName: 'BCA',
      accountNumber: '1234567890',
      accountName: 'Toko Bangunan Simetri',
    },
    gopay: {
      enabled: true,
      merchantPhone: '08123456789',
      merchantName: 'Toko Bangunan Simetri',
    },
  },
}

const mockCustomerAccounts: CustomerAccount[] = [
  {
    id: 'ca-1',
    tenantId: 'ten-001',
    name: 'Budi Santoso',
    email: 'budi@email.com',
    phone: '08123456789',
    password: 'hashed',
    status: 'active_transfer',
    creditLimit: 0,
    paymentTermDays: 0,
    outstandingDebt: 0,
    internalCustomerId: null,
    approvedBy: 'u-2',
    approvedAt: new Date('2025-01-10'),
    notes: 'Customer kontraktor kecil, bayar transfer selalu tepat waktu',
    createdAt: new Date('2025-01-08'),
  },
  {
    id: 'ca-2',
    tenantId: 'ten-001',
    name: 'PT Abadi Jaya Konstruksi',
    email: 'procurement@abadijaya.id',
    phone: '02187654321',
    password: 'hashed',
    status: 'member_tempo',
    creditLimit: 50000000,
    paymentTermDays: 30,
    outstandingDebt: 12000000,
    internalCustomerId: 'cus-1',   // terhubung ke Customer internal SES
    approvedBy: 'u-1',
    approvedAt: new Date('2024-06-01'),
    notes: 'Pelanggan lama, pembayaran konsisten',
    createdAt: new Date('2024-05-20'),
  },
  {
    id: 'ca-3',
    tenantId: 'ten-001',
    name: 'Hendra Wijaya',
    email: 'hendra@gmail.com',
    phone: '08198765432',
    password: 'hashed',
    status: 'pending_approval',
    creditLimit: 0,
    paymentTermDays: 0,
    outstandingDebt: 0,
    internalCustomerId: null,
    approvedBy: null,
    approvedAt: null,
    notes: '',
    createdAt: new Date('2025-01-14'),
  },
]

const mockOnlineOrders: OnlineOrder[] = [
  {
    id: 'oo-1',
    tenantId: 'ten-001',
    branchId: 'cbg-1',
    orderNumber: 'ORD-2025-01-0045',
    customerAccountId: 'ca-1',
    customerName: 'Budi Santoso',
    customerPhone: '08123456789',
    items: [
      { productId: 'p-1', productName: 'Semen Portland 50kg', sku: 'BRG-001', unit: 'sak', qty: 10, sellingPrice: 65000, subtotal: 650000 },
      { productId: 'p-3', productName: 'Cat Tembok Putih 5kg', sku: 'BRG-003', unit: 'kaleng', qty: 5, sellingPrice: 45000, subtotal: 225000 },
    ],
    deliveryAddress: 'Jl. Proyek Perumahan Blok A, Bekasi',
    notes: 'Mohon kirim sebelum jam 10 pagi',
    subtotal: 875000,
    grandTotal: 875000,
    paymentMethod: 'transfer',
    paymentStatus: 'unpaid',
    transferProofUrl: null,
    status: 'approved',     // toko sudah approve, menunggu customer transfer
    salesOrderId: null,
    waNotifications: [
      { id: 'wa-1', recipient: 'store', phoneNumber: '6281234567890', templateType: 'new_order', sentAt: new Date('2025-01-15T10:00:00'), status: 'delivered', messagePreview: '🔔 Pesanan Baru! ORD-2025-01-0045 — Budi Santoso — Rp 875.000' },
      { id: 'wa-2', recipient: 'customer', phoneNumber: '628123456789', templateType: 'payment_request', sentAt: new Date('2025-01-15T10:15:00'), status: 'delivered', messagePreview: '✅ Pesanan Disetujui! Silakan transfer Rp 875.000 ke BCA 1234567890' },
    ],
    createdAt: new Date('2025-01-15T10:00:00'),
    updatedAt: new Date('2025-01-15T10:15:00'),
  },
  {
    id: 'oo-2',
    tenantId: 'ten-001',
    branchId: 'cbg-1',
    orderNumber: 'ORD-2025-01-0044',
    customerAccountId: 'ca-2',
    customerName: 'PT Abadi Jaya Konstruksi',
    customerPhone: '02187654321',
    items: [
      { productId: 'p-1', productName: 'Semen Portland 50kg', sku: 'BRG-001', unit: 'sak', qty: 50, sellingPrice: 65000, subtotal: 3250000 },
    ],
    deliveryAddress: 'Jl. Gatot Subroto No. 88, Jakarta',
    notes: '',
    subtotal: 3250000,
    grandTotal: 3250000,
    paymentMethod: 'tempo',    // member, langsung proses
    paymentStatus: 'unpaid',   // bayar belakangan sesuai termin
    transferProofUrl: null,
    status: 'processing',
    salesOrderId: 'so-2',      // sudah masuk ke SO internal
    waNotifications: [],
    createdAt: new Date('2025-01-14T09:00:00'),
    updatedAt: new Date('2025-01-14T09:05:00'),
  },
]


const mockStockTransfers: StockTransfer[] = [
  {
    id: 'trsf-1',
    transferNumber: 'TRSF-2025-01-001',
    fromBranchId: 'cbg-3',
    fromBranchName: 'Cabang Bekasi',
    toBranchId: 'cbg-1',
    toBranchName: 'Cabang Sudirman',
    items: [
      { productId: 'p-3', productName: 'Cat Tembok Putih 5kg', sku: 'BRG-003', unit: 'kaleng', requestedQty: 10, sentQty: 10, receivedQty: 0 },
    ],
    status: 'sent',  // menunggu konfirmasi Cabang Sudirman
    notes: 'Pengiriman darurat — stok Sudirman kritis',
    createdBy: 'u-6',
    confirmedBy: null,
    sentAt: new Date('2025-01-15T09:00:00'),
    receivedAt: null,
    createdAt: new Date('2025-01-15T08:30:00'),
  },
]

// ─── DASHBOARD SUMMARY ─────────────────────────────────────────

// Per cabang
const mockDashboardSudirman: DashboardSummary = {
  branchId: 'cbg-1',
  todaySales: 4500000, todayTransactions: 47, lowStockCount: 1,
  totalAR: 17500000, totalAP: 25000000, overdueAR: 12000000, overdueAP: 0,
  cashBalance: 28000000, monthlyRevenue: 45000000, monthlyExpense: 32000000,
  monthlyGrossProfit: 13000000, monthlyNetProfit: 9500000,
}

// Konsolidasi semua cabang (owner only)
const mockDashboardAll: DashboardSummary = {
  branchId: 'all',
  todaySales: 12800000, todayTransactions: 136, lowStockCount: 21,
  totalAR: 87400000, totalAP: 33500000, overdueAR: 22000000, overdueAP: 8500000,
  cashBalance: 76800000, monthlyRevenue: 125000000, monthlyExpense: 85000000,
  monthlyGrossProfit: 40000000, monthlyNetProfit: 28000000,
  branchSummaries: [
    { branchId: 'cbg-1', branchName: 'Cabang Sudirman', todaySales: 4500000, todayTransactions: 47, lowStockCount: 1, monthlyRevenue: 45000000, monthlyNetProfit: 9500000 },
    { branchId: 'cbg-2', branchName: 'Cabang Kebon Jeruk', todaySales: 3200000, todayTransactions: 31, lowStockCount: 5, monthlyRevenue: 38000000, monthlyNetProfit: 8200000 },
    { branchId: 'cbg-3', branchName: 'Cabang Bekasi', todaySales: 5100000, todayTransactions: 58, lowStockCount: 15, monthlyRevenue: 42000000, monthlyNetProfit: 10300000 },
  ],
}
// ─── SALES ORDER ───────────────────────────────────────────────

const mockSalesOrders: SalesOrder[] = [
  {
    id: 'so-1',
    branchId: 'cbg-1',
    soNumber: 'SO-2025-01-0012',
    customerId: 'cus-1',
    customerName: 'PT Abadi Jaya Konstruksi',
    deliveryAddress: 'Jl. Proyek Perumahan Blok A No. 5, Bekasi',
    items: [
      {
        id: 'soi-1',
        soId: 'so-1',
        productId: 'p-6',
        productName: 'Bata Ringan 7.5cm',
        sku: 'BRG-010',
        unit: 'Kubik',
        qty: 10.8,
        sellingPrice: 85000,
        discount: 0,
        subtotal: 918000,
        fulfillments: [
          // 5 kubik dari stok toko
          { source: 'stock', qty: 5, purchaseOrderId: null, supplierId: null, purchasePriceAtTime: 65000, status: 'delivered' },
          // 5.8 kubik indent langsung dari supplier ke klien
          { source: 'indent', qty: 5.8, purchaseOrderId: 'po-indent-1', supplierId: 'sup-3', purchasePriceAtTime: 65000, status: 'in_progress' },
        ],
        deliveredQty: 5,
        status: 'partial',
      },
      {
        id: 'soi-2',
        soId: 'so-1',
        productId: 'p-1',
        productName: 'Semen Portland 50kg',
        sku: 'BRG-001',
        unit: 'Sak',
        qty: 20,
        sellingPrice: 65000,
        discount: 0,
        subtotal: 1300000,
        fulfillments: [
          { source: 'stock', qty: 20, purchaseOrderId: null, supplierId: null, purchasePriceAtTime: 57000, status: 'delivered' },
        ],
        deliveredQty: 20,
        status: 'fulfilled',
      },
    ],
    subtotal: 2218000,
    discountAmount: 0,
    grandTotal: 2218000,
    downPayment: 1000000,
    remainingPayment: 1218000,
    status: 'partial_delivered',
    paymentStatus: 'partial',
    estimatedDeliveryDate: new Date('2025-01-18'),
    notes: 'Kirim ke lokasi proyek, hubungi Pak Joko 081234',
    createdBy: 'u-2',
    createdAt: new Date('2025-01-15'),
    completedAt: null,
  },
]

// PO Indent yang dibuat dari SO di atas
const mockIndentPO: PurchaseOrder = {
  id: 'po-indent-1',
  branchId: 'cbg-1',
  poNumber: 'PO-2025-01-0031',
  type: 'indent',
  salesOrderId: 'so-1',   // referensi ke SO
  supplierId: 'sup-3',
  supplierName: 'PT Bata Ringan Indonesia',
  deliveryAddress: 'Jl. Proyek Perumahan Blok A No. 5, Bekasi', // alamat KLIEN
  items: [
    { productId: 'p-6', productName: 'Bata Ringan 7.5cm', sku: 'BRG-010', unit: 'Kubik', orderedQty: 5.8, receivedQty: 0, purchasePrice: 65000, subtotal: 377000 },
  ],
  subtotal: 377000,
  grandTotal: 377000,
  status: 'sent',
  expectedDate: new Date('2025-01-18'),
  notes: 'Kirim langsung ke lokasi klien PT Abadi Jaya — ref SO-2025-01-0012',
  createdBy: 'u-2',
  createdAt: new Date('2025-01-15'),
}
```

---

## Success Criteria

- ✅ Semua modul render dengan data mock yang realistis
- ✅ Multi-tenant: data tiap toko terisolasi penuh per `tenantId`
- ✅ Modul Onboarding: 4 jalur guided, Library Produk, Import Excel, form input massal
- ✅ Legacy Stock Mode: transaksi jalan meski stok = 0 selama onboarding aktif
- ✅ Dashboard Branch Switcher, mode konsolidasi owner, manager multi-cabang
- ✅ Transfer Stok antar cabang dengan alur lengkap dan audit trail
- ✅ Kas Session per kasir: buka shift, multi-keranjang, tutup shift rekonsiliasi
- ✅ Ambil alih keranjang lintas kasir, audit trail `inputBy` & `paidBy`
- ✅ Sales Order: split fulfillment stok toko + indent, PO Indent terhubung ke SO
- ✅ Inventory, Keuangan, Hutang/Piutang, Pembelian, Laporan berfungsi penuh
- ✅ **PWA**: aplikasi bisa diinstal di perangkat kasir dan dibuka tanpa internet
- ✅ **Service Worker**: app shell dan aset statis di-cache — halaman kasir muat tanpa koneksi
- ✅ **IndexedDB cache**: produk, harga, data pelanggan, konfigurasi shift tersimpan lokal
- ✅ **Offline indicator**: banner merah persisten + jumlah transaksi pending tampil saat offline
- ✅ **Transaksi offline**: checkout tetap bisa dilakukan saat `navigator.onLine === false`
- ✅ **Force Checkout modal**: konfirmasi eksplisit kasir sebelum checkout offline, dengan penjelasan validasi yang dinonaktifkan
- ✅ **Transaction Queue**: setiap transaksi offline masuk `txQueue` di IndexedDB + Zustand
- ✅ **Background Sync**: otomatis menembak bulk-insert ke Laravel saat online kembali (Chrome/Android)
- ✅ **Manual Sync fallback**: tombol "Sinkronkan Sekarang" untuk iOS Safari dan kasus lainnya
- ✅ **Rekonsiliasi Laravel**: backend proses queue dalam urutan `offlineCreatedAt`, deteksi `STOCK_DEFICIT` dan `CREDIT_EXCEEDED`
- ✅ **Dashboard flagging**: manager lihat alert rekonsiliasi per transaksi bermasalah, bisa langsung aksi Stock Adjustment atau lihat AR
- ✅ **Struk offline**: printer Bluetooth generate struk dari data lokal tanpa butuh server, diberi label `[OFFLINE - Pending Sync]`
- ✅ **Label offline hilang**: setelah sync berhasil, transaksi tidak lagi ditandai offline di laporan
- ✅ POS: Tunai, Kartu/EDC, QRIS (EDC/GoPay/OVO), Transfer, Piutang — semua konfirmasi manual
- ✅ `qrisProvider` tercatat, tidak ada payment gateway, nol biaya per transaksi
- ✅ Customer Portal: katalog, Transfer & GoPay manual, Tempo member, notif WA
- ✅ RBAC lengkap: role + cabang + tenant
- ✅ Responsive, dark & light mode, Bahasa Indonesia
- ✅ NO backend calls, NO API integration (static mock only)
- ✅ Semua interface memiliki `tenantId` — siap koneksi ke Laravel REST API + PostgreSQL

## Failed Criteria

- ❌ **Aplikasi tidak bisa dibuka saat offline** — PWA/Service Worker tidak terkonfigurasi
- ❌ **Tidak ada offline indicator** — kasir tidak tahu sedang dalam mode offline
- ❌ **Transaksi diblokir saat offline** — kasir harus tutup toko saat internet mati
- ❌ **Force Checkout tanpa konfirmasi** — kasir tidak diberi tahu bahwa validasi stok/limit dinonaktifkan
- ❌ **Transaksi offline hilang** — tidak ada queue lokal, data terbuang saat browser ditutup
- ❌ **Tidak ada background sync** — transaksi offline tidak pernah terkirim ke server
- ❌ **Tidak ada manual sync fallback** — pengguna iOS tidak bisa sync sama sekali
- ❌ **Backend tidak rekonsiliasi** — stok minus dan credit exceeded tidak terdeteksi pasca sync
- ❌ **Tidak ada dashboard flagging** — manager tidak tahu ada masalah dari transaksi offline
- ❌ **Struk tidak bisa dicetak saat offline** — printer LAN/USB tidak bisa dipakai tanpa server
- ❌ **Struk offline tidak diberi label** — tidak bisa dibedakan mana transaksi online vs offline
- ❌ Customer bisa lihat angka stok pasti di portal
- ❌ Portal tidak dipisah per tenant
- ❌ QRIS di POS tidak bisa pilih sub-provider
- ❌ Member tempo bisa order melebihi credit limit tanpa warning
- ❌ Order online tidak terhubung ke SO internal
- ❌ Data antar tenant bisa saling terlihat
- ❌ Legacy mode tidak aktif — transaksi diblokir karena stok = 0
- ❌ Kasir bisa transaksi tanpa membuka shift
- ❌ Tidak ada rekonsiliasi kas saat tutup shift
- ❌ Keranjang terikat ke satu kasir, tidak bisa diambil alih
- ❌ PO Indent mengurangi stok toko
- ❌ SO tidak bisa split fulfillment
- ❌ Role kasir bisa lihat harga beli atau laporan keuangan
- ❌ Laporan konsolidasi tidak bisa drill down ke per cabang
- ❌ Tidak ada empty state yang jelas di tiap modul
- ❌ Tampilan tidak responsive di layar mobile/tablet
- ❌ Export laporan tidak berfungsi (PDF / Excel)
