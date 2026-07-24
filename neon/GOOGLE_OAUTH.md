# Google OAuth — Setup & Batasan

Google Cloud **tidak menerima** IP lokal (`192.168.x.x`) untuk OAuth redirect URI.
Pesan error di Console: *"Must end with a public top-level domain"*.

## Yang didukung Google

| Origin | Login Google |
|--------|--------------|
| `http://localhost:8081` (PC) | ✅ |
| `https://yourdomain.com` (production) | ✅ |
| `https://xxxx.ngrok-free.app` (tunnel dev) | ✅ |
| `http://192.168.0.107:8081` (WiFi LAN) | ❌ |

## Dev di PC (localhost)

Google Console → OAuth Client:

**Authorized JavaScript origins**
```
http://localhost:8081
```

**Authorized redirect URIs**
```
http://localhost:8081/auth/google/callback
```

Hapus entri `192.168.x.x` — Google akan menolaknya.

## iPad / iPhone via WiFi

### Opsi A — Register/login email (paling mudah)

Form email/password **tetap jalan** via `http://192.168.x.x:8081` — tidak perlu Google Console.

### Opsi B — ngrok (login Google di mobile)

1. Install [ngrok](https://ngrok.com/)
2. Jalankan: `ngrok http 8081`
3. Salin URL HTTPS, mis. `https://abc123.ngrok-free.app`
4. Google Console → tambahkan:
   - Origin: `https://abc123.ngrok-free.app`
   - Redirect: `https://abc123.ngrok-free.app/auth/google/callback`
5. `.env`:
   ```env
   VITE_PUBLIC_APP_URL=https://abc123.ngrok-free.app
   AUTH_URL=https://abc123.ngrok-free.app
   ```
6. Restart dev server, buka **URL ngrok** di iPhone (bukan IP LAN)

## Production

Daftarkan domain production Anda di Google Console, set `AUTH_URL` ke URL production.
