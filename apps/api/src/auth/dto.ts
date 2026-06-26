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

export const forgotPasswordSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase())
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8).max(256)
});

export const verifyEmailSchema = z.object({
  token: z.string().min(16)
});

export const mfaChallengeSchema = z.object({
  tempToken: z.string().min(16),
  code: z.string().min(6).max(16)
});

export const mfaVerifySchema = z.object({
  code: z.string().min(6).max(16)
});

export const mfaDisableSchema = z.object({
  code: z.string().min(6).max(16)
});

export const mfaRecoverySchema = z.object({
  tempToken: z.string().min(16),
  backupCode: z.string().min(8).max(32)
});

export const stepUpSchema = z.object({
  password: z.string().min(1).max(256).optional(),
  totpCode: z.string().min(6).max(16).optional()
}).refine((value) => Boolean(value.password || value.totpCode), {
  message: 'Password or TOTP code is required.'
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type LogoutDto = z.infer<typeof logoutSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>;
export type MfaChallengeDto = z.infer<typeof mfaChallengeSchema>;
export type MfaVerifyDto = z.infer<typeof mfaVerifySchema>;
export type MfaDisableDto = z.infer<typeof mfaDisableSchema>;
export type MfaRecoveryDto = z.infer<typeof mfaRecoverySchema>;
export type StepUpDto = z.infer<typeof stepUpSchema>;

export type AuthUserDto = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationDomain: string;
  email: string;
  name: string;
  role: string;
  status: string;
  emailVerifiedAt: string | null;
  mfaEnabled: boolean;
  mfaRequired: boolean;
};

export type AuthResponseDto = {
  data: {
    accessToken: string;
    tokenType: 'Bearer';
    expiresInSeconds: number;
    user: AuthUserDto;
  };
};

export type MfaRequiredResponseDto = {
  data: { mfaRequired: true; tempToken: string; user: Pick<AuthUserDto, 'email' | 'name'>; };
};
