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

1. **Transfer BCA (utama, tanpa fee Midtrans):** Daftar trial → Upgrade paket → Transfer BCA (nominal unik + berita `SEPS-…`) → unggah bukti → Make.com forward email mutasi BCA → auto-aktif jika BCA + OCR cocok; selain itu antrian review di `/platform/dashboard`.
2. **Midtrans Snap (opsional):** QRIS/VA/GoPay → webhook Midtrans aktifkan plan.
3. **Manual:** platform admin **Tandai lunas** / setujui antrian transfer.

**Kontak:** Tim SEPS / Faza Group · WhatsApp sales

*Harga belum termasuk PPN.*

### Production (`seps.fazagroup.id`) — env plan billing

```
# Transfer BCA + OCR
PLAN_BCA_ACCOUNT_NUMBER=
PLAN_BCA_ACCOUNT_NAME=
PLAN_BCA_WEBHOOK_SECRET=
GEMINI_API_KEY=
RESEND_API_KEY=
FONNTE_TOKEN=                  # opsional WA aktivasi

# Make.com → POST https://seps.fazagroup.id/api/plan-billing/bca-inbound
# Header: x-plan-bca-secret = PLAN_BCA_WEBHOOK_SECRET

# Midtrans (opsional)
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=true
MIDTRANS_NOTIFICATION_URL=https://seps.fazagroup.id/api/midtrans/notification
PLAN_OPS_TELEGRAM_BOT_TOKEN=
PLAN_OPS_TELEGRAM_CHAT_ID=
```

Cron harian (reminder + `past_due`): `npm run neon:plan:renew-check`

---

**URL pricing live:** https://seps.fazagroup.id/pricing · **Registrasi:** `/register`  
**Webhook BCA:** `POST /api/plan-billing/bca-inbound` · **Webhook Midtrans:** `POST /api/midtrans/notification`
