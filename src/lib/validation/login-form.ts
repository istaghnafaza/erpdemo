import { z } from "zod";

/** Validasi ketat login — password PIN maks. 6 digit angka. */
export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi")
    .max(254, "Email terlalu panjang")
    .email("Format email tidak valid"),
  password: z
    .string()
    .min(1, "Password wajib diisi")
    .max(6, "Password maksimal 6 karakter")
    .regex(/^\d+$/, "Password hanya boleh angka (PIN)"),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export function validateLoginForm(input: { email: string; password: string }) {
  return loginFormSchema.safeParse(input);
}
