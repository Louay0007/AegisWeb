import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(256),
  organizationName: z.string().min(1).max(160),
  organizationDomain: z
    .string()
    .min(1)
    .max(160)
    .transform((value) => value.toLowerCase())
});

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(256)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(32).optional()
});

export const logoutSchema = refreshSchema;

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type LogoutDto = z.infer<typeof logoutSchema>;

export type AuthUserDto = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationDomain: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

export type AuthResponseDto = {
  data: {
    accessToken: string;
    tokenType: 'Bearer';
    expiresInSeconds: number;
    user: AuthUserDto;
  };
};
