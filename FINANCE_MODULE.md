# Modul Keuangan — Progress, Logika Bisnis & Alur Perubahan

> **Proyek:** SEPS (Simetri ERP Store)  
> **Terakhir diperbarui:** 2026-08-14  
> **Status:** Live Neon (`cash_accounts` / `cash_transactions`, AR/AP, stok). Tenant mock tetap memakai localStorage untuk demo.

---

## 1. Ringkasan

| Area | Status | Keterangan |
|------|--------|------------|
| Dashboard Keuangan (`/finance`) | ✅ | Saldo, P&L terpadu, arus kas, kartu Kas vs Laba |
| Buku Kas (`/finance/cash-book`) | ✅ | Pengeluaran + **transfer internal** berpasangan |
| Forecast kas (`/finance/forecast`) | ✅ | 30 hari, on-read (AR + avg POS − AP) |
| Cash lock stok (`/finance/cash-lock`) | ✅ | Fast / slow / dead dari outbound (bukan opname) |
| Prive / setoran (`/finance/owner-capital`) | ✅ | Ubah kas, **tidak** masuk laba. RBAC owner + accountant |
| Piutang / Hutang | ✅ | Pelunasan AR cash **dan** transfer masuk buku kas |
| Laporan Laba Rugi | ✅ | Mesin P&L yang sama dengan dashboard & `/finance` |

**Role:** `owner`, `manager`, `accountant` (`src/lib/rbac.ts`). Prive/setoran: owner + accountant.

---

## 2. Fondasi data (Neon)

- Kas Riil = Σ `cash_accounts.balance` (scope cabang / konsolidasi). Transfer internal net-zero.
- P&L: revenue + margin dari penjualan stok; **baris SO ditunda sampai fulfillment** (`so_fulfillments.status = delivered`).
- Opex dari buku kas, exclude HPP / Pembelian / Retur / Void / Prive / Setoran Owner / pembayaran AP.
- Akun default per cabang: `cash_accounts.is_default` (satu kas + satu bank). POS QRIS/transfer/kartu → bank default; tunai → kas default.
- Transfer internal: dua baris `type=transfer` (`Transfer Keluar` / `Transfer Masuk`) dengan `pair_id` + `counterpart_account_id`.

File inti: `src/server/services/pnl.ts`, `finance.ts`, `cashflow-intelligence.ts`, `owner-capital.ts`.

---

## 3. Alur penting

1. Checkout POS → buku kas (akun default) + AR jika kredit.
2. Fulfillment SO dari stok → HPP tercatat (`purchase_price_at_time`) + P&L mengenali revenue/margin.
3. Pelunasan AR → income `Penagihan Piutang` (tunai → kas default, transfer → bank default).
4. Bayar AP → expense `Pembayaran Hutang` (bukan opex P&L).
5. Prive/setoran → baris `owner_capital_transactions` + satu baris buku kas.

Migrasi: `neon/phase20_cashflow_intelligence.sql` (+ `ensureCashflowSchema()` idempotent).
