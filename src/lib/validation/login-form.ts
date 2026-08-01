import { z } from "zod";
import { AUTH_UI } from "@/lib/auth-features";

const pinSchema = z
  .string()
  .min(1, "PIN wajib diisi")
  .max(6, "PIN maksimal 6 karakter")
  .regex(/^\d+$/, "PIN hanya boleh angka (6 digit)");

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username minimal 3 karakter")
  .max(32, "Username maksimal 32 karakter")
  .regex(/^[a-z0-9._-]+$/i, "Username hanya huruf, angka, titik, strip, underscore");

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email wajib diisi")
  .max(254, "Email terlalu panjang")
  .email("Format email tidak valid");

/** Login identifier: username (default) atau email untuk akun lama. */
const loginIdentifierSchema = AUTH_UI.loginWithUsername
  ? z
      .string()
      .trim()
      .min(1, "Username wajib diisi")
      .max(254)
      .superRefine((val, ctx) => {
        if (val.includes("@")) {
          const r = emailSchema.safeParse(val);
          if (!r.success) {
            ctx.addIssue({ code: "custom", message: "Format email tidak valid" });
          }
          return;
        }
        const r = usernameSchema.safeParse(val);
        if (!r.success) {
          ctx.addIssue({
            code: "custom",
            message: r.error.issues[0]?.message ?? "Username tidak valid",
          });
        }
      })
  : emailSchema;

export const loginFormSchema = z.object({
  username: loginIdentifierSchema,
  password: pinSchema,
});

/** @deprecated gunakan field username — alias untuk kompatibilitas parser lama */
export const loginFormSchemaLegacy = z.object({
  email: loginIdentifierSchema,
  password: pinSchema,
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export function validateLoginForm(input: { username?: string; email?: string; password: string }) {
  const username = input.username ?? input.email ?? "";
  return loginFormSchema.safeParse({ username, password: input.password });
}
