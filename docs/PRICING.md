# SEPS — Halaman Pricing (1 halaman)

**Simetri ERP Store · Paket Langganan · Berlaku Juli 2026**

---

## Trial — Gratis 7 Hari

| | |
|---|---|
| **Harga** | Rp 0 |
| **Durasi** | Maks. **7 hari** |
| **Cabang** | 2 |
| **User** | 15 |
| **Fitur** | Semua modul ERP (setara Pro) |

Daftar di [seps.fazagroup.id/register](https://seps.fazagroup.id/register) — tanpa kartu kredit.

---

## Basic — Toko Tunggal

| Bulanan | Tahunan (hemat) |
|---------|-----------------|
| **Rp 599.000** / bulan | **Rp 499.000** / tahun |

| Limit | Nilai |
|-------|-------|
| Cabang | 1 |
| User | 5 |

Cocok untuk: toko bangunan 1 lokasi, owner + kasir + gudang.

---

## Pro — Multi-Cabang (Paling Populer)

| Bulanan | Tahunan (hemat) |
|---------|-----------------|
| **Rp 849.000** / bulan | **Rp 749.000** / tahun |

| Limit | Nilai |
|-------|-------|
| Cabang | **2** |
| User | **15** |

Cocok untuk: 2 cabang, tim 10–15 orang, konsolidasi laporan owner.

---

## Enterprise — Skala Besar / Cabang ke-3+

| Bulanan | Tahunan (hemat) |
|---------|-----------------|
| **Rp 2.499.000** / bulan | **Rp 1.999.000** / tahun |

| Limit | Nilai |
|-------|-------|
| Cabang | Tanpa batas praktis |
| User | Tanpa batas praktis |

**Kapan upgrade?** Saat Pro sudah 2 cabang dan owner ingin buka cabang ke-3, atau butuh user > 15.

Termasuk: prioritas onboarding, SLA, account manager.

---

## Semua Paket Berbayar Include

- POS kasir (tunai, QRIS, transfer, tempo)
- Stok real-time + transfer antar cabang
- Piutang, hutang, laba rugi
- Multi-user + audit per kasir
- Dashboard owner & notifikasi stok kritis

---

## Cara Order

1. **Self-service (otomatis):** Daftar trial → uji 7 hari → di app / `/pricing` pilih paket → bayar Midtrans Snap (QRIS/VA/GoPay) → webhook aktifkan plan.
2. **Exception:** gagal bayar berulang, dispute, atau transfer di luar Snap → platform admin **Tandai lunas manual** (order id).

**Kontak:** Tim SEPS / Faza Group · WhatsApp sales

*Harga belum termasuk PPN.*

### Midtrans (ops)

```
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_NOTIFICATION_URL=https://staging.seps.fazagroup.id/api/midtrans/notification
PLAN_OPS_TELEGRAM_BOT_TOKEN=   # opsional alert past_due / jatuh tempo
PLAN_OPS_TELEGRAM_CHAT_ID=
```

Cron harian (reminder + `past_due`): `npm run neon:plan:renew-check`

---

**URL pricing live:** `/pricing` · **Registrasi:** `/register` · **Webhook:** `POST /api/midtrans/notification`
