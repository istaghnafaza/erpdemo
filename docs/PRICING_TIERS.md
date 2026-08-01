# Pricing Tiers — SEPS MVP

**Status:** MVP-1 + MVP-2 (Agustus 2026)  
**Akses konfigurasi:** Owner & Manager → **Pengaturan → Harga & Diskon**

## Ringkasan

Dua dimensi diskon (stack dengan cap):

1. **Tier volume (T0–T3)** — berdasarkan qty atau nilai baris per SKU  
2. **Tier pelanggan (P0–P4)** — diskon % identitas pelanggan  

```
Diskon efektif = min(volume% + customer%, cap_stack, cap_per_line)
Harga net      = max(harga_dasar × (1 - diskon_efektif), floor_price)
floor_price    = HPP × (1 + margin_min_kategori)
```

## Tier default

| Kode | Volume | Min qty | Min nilai baris | Diskon |
|------|--------|---------|-----------------|--------|
| T0 | Eceran | 0 | 0 | 0% |
| T1 | Grosir Kecil | 10 | Rp 500rb | 3% |
| T2 | Grosir | 50 | Rp 2jt | 6% |
| T3 | Proyek | 200 | Rp 10jt | 8% |

| Kode | Pelanggan | Diskon | Syarat (panduan) |
|------|-----------|--------|------------------|
| P0 | Umum | 0% | Default |
| P1 | Member | 2% | 3 transaksi / 90 hari |
| P2 | Silver | 4% | Omzet 12 bln ≥ Rp 50jt |
| P3 | Kontraktor | 5% | Penetapan manual + benefit tier volume |
| P4 | Strategic | 7% | Omzet 12 bln ≥ Rp 500jt |

**Kontraktor:** diskon % + tier volume — **tanpa** harga kontrak per SKU per periode.

## Cap global (default)

- Maks stack: **12%**
- Maks per baris: **10%**
- Margin min default: **10%**

## POS

- Harga di keranjang dihitung otomatis saat tambah barang / ubah qty / ganti pelanggan  
- Baris **SO (indent)** — hanya tier volume, tanpa diskon pelanggan  
- Floor price — harga tidak boleh di bawah margin minimum  

## Override manager

- Manager/owner dapat override harga di bawah floor (UI lanjutan)  
- Log audit: tabel `pricing_override_logs`

## Migrasi

```bash
npm run neon:migrate   # phase12_pricing.sql
```

## File utama

- `src/lib/pricing-engine.ts` — perhitungan  
- `src/server/services/pricing.ts` — CRUD Neon  
- `src/routes/$tenantSlug/settings/pricing.tsx` — UI konfigurasi  
- `src/hooks/usePos.ts` — integrasi POS  
