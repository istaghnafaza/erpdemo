/**
 * Flag UI auth sementara — ubah di sini saat uji lokal selesai.
 * showGoogleAuth: tampilkan tombol Google login/daftar
 * loginWithUsername: form login pakai username (bukan email); email lama tetap bisa dipakai
 * showForgotPassword: tautan + halaman lupa PIN (email/SMS OTP)
 */
export const AUTH_UI = {
  showGoogleAuth: false,
  loginWithUsername: true,
  showForgotPassword: false,
} as const;
