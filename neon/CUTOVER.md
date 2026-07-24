# Fase 6 — Cutover Neon & Decommission Supabase

Checklist operasional sebelum production memakai `VITE_DATA_BACKEND=neon` penuh.

## Prasyarat

- [ ] Fase 0–5 selesai (`npm run neon:setup` sudah dijalankan)
- [ ] `.env` production: `VITE_DATA_BACKEND=neon`
- [ ] `DATABASE_URL` + `DATABASE_URL_DIRECT` + `AUTH_SECRET` + `AUTH_URL` terisi
- [ ] Smoke test DB: `npm run neon:health` → `ok: true`, `tenantCount >= 1`

## UAT (staging / local)

| # | Alur | OK |
|---|------|----|
| 1 | Login email (`budi@simetri.id`) | ☐ |
| 2 | Onboarding / master cabang & produk | ☐ |
| 3 | POS: buka shift → checkout tunai & kredit | ☐ |
| 4 | Offline queue sync (putus jaringan → sync ulang) | ☐ |
| 5 | Finance: AR/AP, pembayaran | ☐ |
| 6 | PO → kirim → GRN (stok naik) | ☐ |
| 7 | Sales order → fulfillment | ☐ |
| 8 | Transfer & opname stok | ☐ |
| 9 | Dashboard & laporan | ☐ |
| 10 | Notifikasi (piutang jatuh tempo, stok kritis) muncul tanpa Supabase | ☐ |

## Cutover production

| # | Task |
|---|------|
| 1 | Export data Supabase pilot (jika ada) → import ke Neon |
| 2 | Set env production: `VITE_DATA_BACKEND=neon` |
| 3 | **Hapus** `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dari production |
| 4 | Deploy build baru |
| 5 | Verifikasi `npm run neon:health` dari CI atau runbook |
| 6 | Monitor KPI 48 jam pertama (latency, error rate, sync success) |

## Monitoring KPI

| Metrik | Target |
|--------|--------|
| API latency p95 | < 200 ms |
| DB connection errors | < 0.1% |
| Offline sync success | ≥ 99.5% |
| RPO (Neon PITR) | ≤ 5 menit |
| RTO (restore drill) | ≤ 1 jam |

## Rollback (≤ 2 minggu pasca cutover)

Jika cutover gagal:

1. Set `VITE_DATA_BACKEND=supabase` + restore `VITE_SUPABASE_*` di env
2. Redeploy build sebelumnya
3. Reconcile transaksi yang hanya ada di Neon (manual atau replay)

Paket `@supabase/supabase-js` **dipertahankan** selama jendela rollback. Hapus setelah 2 minggu stabil.

## Perubahan kode Fase 6

- `notification.store.ts` — polling via API (`getReceivables`, `getPayables`, `getStockAlerts`); Realtime hanya jika `VITE_DATA_BACKEND=supabase`
- `npm run neon:health` — smoke test koneksi DB
- `npm run neon:uat` — cek schema, env, tabel penting
- `neonHealthCheck` server fn — health dari runtime app
- `src/start.ts` — CSRF middleware untuk server functions
- `src/lib/offline/sync-metrics.ts` — KPI sync success rate
- `listSalesTransactions` — histori penjualan dari Neon
- Register/login Google OAuth — `/register`, `/login`
- DB driver WebSocket Pool — transaksi atomik (register, POS, finance)
