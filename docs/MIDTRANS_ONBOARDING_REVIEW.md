# Midtrans Onboarding — Checklist Approve SEPS

Midtrans meminta **2 dokumen tambahan**. Ikuti checklist ini.

---

## A. Akun kredensial untuk Midtrans uji transaksi

Buat **akun khusus review** (jangan kasih password owner utama).

### Cara cepat
1. Buka https://seps.fazagroup.id/register  
2. Daftar toko demo, contoh nama: `Midtrans Review Demo`  
3. Selesaikan onboarding minimal (boleh data dummy)  
4. Pastikan login sebagai **owner**  
5. Pastikan Midtrans Snap sudah jalan di production (env `MIDTRANS_*` terisi)

### Isi ke formulir Midtrans / lampirkan di PDF
| Field | Contoh |
|---|---|
| URL | `https://seps.fazagroup.id/login` |
| Username / email | *(email akun yang baru dibuat)* |
| Password | *(password akun itu)* |
| Catatan | Akun khusus QA Midtrans — role owner, bisa uji Upgrade → Snap |

---

## B. Dokumen PDF alur transaksi + screenshot

File siap pakai (cetak ke PDF):

**`docs/midtrans-transaction-flow.html`**

1. Buka file di Chrome  
2. Ambil screenshot nyata dari production (isi kotak “TEMPAT SCREENSHOT”):
   - Login  
   - Dashboard / Pricing + tombol Upgrade  
   - Sheet pilih paket + Bayar  
   - Popup Midtrans Snap  
   - Pembayaran QRIS/VA  
   - Dashboard setelah bayar / paket aktif  
3. `Ctrl+P` → **Save as PDF**  
4. Isi bagian kredensial di halaman 1 PDF  
5. Upload PDF ke field **Dokumen Tambahan** di portal Midtrans

### Alur yang harus terlihat di screenshot
```
Login → Dashboard/Pricing → Upgrade paket → Bayar
→ Midtrans Snap → Bayar (QRIS/VA/GoPay)
→ Webhook aktivasi → Paket aktif
```

---

## C. Tips agar lolos review

- Pakai **production** `seps.fazagroup.id` (bukan localhost).  
- Pastikan Snap muncul saat klik Bayar (kalau error key Midtrans, reviewer gagal uji).  
- Di Midtrans Dashboard, pastikan **Payment Notification URL**:
  `https://seps.fazagroup.id/api/midtrans/notification`  
- Jangan ubah password akun review sampai approve selesai.  
- Kalau Snap masih sandbox key di production, ganti ke **production key** sebelum kirim ke Midtrans.

---

## D. Teks singkat untuk kolom catatan Midtrans (opsional)

```
Mohon review merchant SEPS (SaaS ERP toko bangunan).
URL: https://seps.fazagroup.id/login
Akun uji: [email] / [password]
Alur: Login → Upgrade paket → Midtrans Snap checkout → webhook aktivasi langganan.
Dokumen alur + screenshot terlampir (PDF).
Kontak teknis: [WA/email Anda]
```
