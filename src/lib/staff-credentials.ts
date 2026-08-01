/** Email & username untuk pegawai (modul Users / onboarding). */
export function resolveStaffCredentials(input: {
  name: string;
  username?: string;
  email?: string;
  userId: string;
}): { email: string; username: string } {
  const trimmedUsername = input.username?.trim().toLowerCase();
  if (trimmedUsername && !/^[a-z0-9._-]{3,32}$/.test(trimmedUsername)) {
    throw new Error("Username 3–32 karakter: huruf, angka, titik, strip, underscore");
  }

  const trimmedEmail = input.email?.trim().toLowerCase();
  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new Error("Format email tidak valid");
  }

  const slug =
    input.name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.|\.$/g, "")
      .slice(0, 20) || "staff";

  const email = trimmedEmail || `${slug}.${input.userId.slice(0, 8)}@staff.local`;
  const username = trimmedUsername || `${slug}${input.userId.slice(0, 6)}`.slice(0, 32);

  return { email, username };
}
