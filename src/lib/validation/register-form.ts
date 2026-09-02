import { z } from "zod";



const PHONE_RE = /^[\d\s+\-()]{8,20}$/;



const pinSchema = z

  .string()

  .min(1, "PIN wajib diisi")

  .max(6, "PIN maksimal 6 karakter")

  .regex(/^\d+$/, "PIN hanya boleh angka (6 digit)");



export const ownerAddressSchema = z.object({

  provinceCode: z.string().min(1, "Provinsi wajib dipilih"),

  provinceName: z.string().min(1),

  regencyCode: z.string().min(1, "Kota/Kabupaten wajib dipilih"),

  regencyName: z.string().min(1),

  districtCode: z.string().min(1, "Kecamatan wajib dipilih"),

  districtName: z.string().min(1),

  villageCode: z.string().min(1, "Kelurahan/Desa wajib dipilih"),

  villageName: z.string().min(1),

  street: z

    .string()

    .trim()

    .min(3, "Nama jalan wajib diisi (min. 3 karakter)")

    .max(200, "Nama jalan maksimal 200 karakter"),

});



export const registerFormSchema = z

  .object({

    name: z.string().trim().min(1, "Nama lengkap wajib diisi").max(120),

    username: z

      .string()

      .trim()

      .min(3, "Username minimal 3 karakter")

      .max(32, "Username maksimal 32 karakter")

      .regex(/^[a-z0-9._-]+$/i, "Username hanya huruf, angka, titik, strip, underscore"),

    email: z
      .string()
      .trim()
      .min(1, "Email wajib diisi")
      .max(254)
      .email("Format email tidak valid"),

    phone: z

      .string()

      .trim()

      .min(1, "Nomor telepon wajib diisi")

      .max(20, "Nomor telepon maksimal 20 karakter")

      .regex(PHONE_RE, "Format telepon tidak valid (min. 8 digit)"),

    address: ownerAddressSchema,

    password: pinSchema,

    confirmPassword: pinSchema,

  })

  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {

      ctx.addIssue({

        code: "custom",

        message: "Konfirmasi PIN tidak cocok",

        path: ["confirmPassword"],

      });

    }

  })

  .transform((data) => ({

    ...data,

    username: data.username.trim().toLowerCase(),

    email: data.email.trim().toLowerCase(),

    phone: data.phone.trim(),

  }));



export type RegisterFormValues = z.infer<typeof registerFormSchema>;



export function validateRegisterForm(input: {

  name: string;

  username: string;

  email: string;

  phone: string;

  address: z.input<typeof ownerAddressSchema>;

  password: string;

  confirmPassword: string;

}) {

  return registerFormSchema.safeParse(input);

}

