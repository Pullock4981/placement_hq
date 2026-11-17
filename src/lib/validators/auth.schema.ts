import { z } from 'zod';
import { REGISTRATION_TEAM_ROLES } from '@/constants';
export { USER_ROLES } from '@/constants';

export const LoginSchema = z.object({
  email: z.string({ error: 'Email address is required' }).trim().toLowerCase().email('Please enter a valid email address'),
  password: z.string({ error: 'Password is required' }).min(8, 'Password must be at least 8 characters').refine((value) => new TextEncoder().encode(value).length <= 72, 'Password must be at most 72 UTF-8 bytes'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  name: z.string({ error: 'Full name is required' }).trim().min(2, 'Please enter your full name').max(80),
  email: z.string({ error: 'Email address is required' }).trim().toLowerCase().email('Please enter a valid email address'),
  teamRole: z.enum(REGISTRATION_TEAM_ROLES, { error: 'Select your team role' }),
  discordUsername: z.string({ error: 'Discord username is required' })
    .trim()
    .transform((value) => value.replace(/^@/, ''))
    .pipe(z.string().min(2, 'Enter your Discord username').max(32, 'Discord username must be 32 characters or fewer').regex(/^[a-z0-9_.]+$/i, 'Enter a valid Discord username')),
  discordUserId: z.string({ error: 'Discord user ID is required' }).trim().regex(/^\d{17,20}$/, 'Discord user ID must be a 17–20 digit number'),
  password: z.string({ error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be 72 characters or fewer')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[a-z]/, 'Include at least one lowercase letter')
    .regex(/[0-9]/, 'Include at least one number').refine((value) => new TextEncoder().encode(value).length <= 72, 'Password must be at most 72 UTF-8 bytes'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
