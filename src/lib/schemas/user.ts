import { z } from 'zod';

/**
 * Clerk-backed user identity stored in Firestore under `users/{clerkId}`.
 * We mirror a small subset of Clerk fields + app-specific profile data.
 */

export const subscriptionTierSchema = z.enum([
  'self_serve',
  'openclaw_dwy',
  'enterprise',
]);
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;

export const userSchema = z.object({
  id: z.string().min(1), // Clerk user ID
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  imageUrl: z.string().url().optional(),
  tier: subscriptionTierSchema.default('self_serve'),
  stripeCustomerId: z.string().optional(),
  paddleCustomerId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof userSchema>;

export const userProfileSchema = z.object({
  userId: z.string().min(1),
  company: z.string().max(120).optional(),
  website: z.string().url().optional(),
  industry: z.string().max(80).optional(),
  role: z.string().max(80).optional(),
  timezone: z.string().max(60).optional(),
  onboardingStep: z
    .enum([
      'profile',
      'domain',
      'inbox',
      'leads',
      'persona',
      'first_campaign',
      'complete',
    ])
    .default('profile'),
  onboardingCompleted: z.boolean().default(false),
  preferredStyle: z.string().optional(),
  calendlyUrl: z.string().url().optional(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  company: z.string().max(120).optional(),
  website: z.string().url().optional(),
  industry: z.string().max(80).optional(),
  role: z.string().max(80).optional(),
  timezone: z.string().max(60).optional(),
  preferredStyle: z.string().max(40).optional(),
  phone: z.string().max(30).optional(),
  calendlyUrl: z.string().url().optional(),
  preferences: z
    .object({
      emailNotifications: z.boolean().optional(),
      autoFollowUp: z.boolean().optional(),
      weeklyReport: z.boolean().optional(),
    })
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateOnboardingSchema = z.object({
  step: z.enum([
    'profile',
    'domain',
    'inbox',
    'leads',
    'persona',
    'first_campaign',
    'complete',
  ]),
  completed: z.boolean(),
  industry: z.string().max(80).optional(),
  industryOther: z.string().max(80).optional(),
  persona: z.string().max(40).optional(),
  onboardingComplete: z.boolean().optional(),
});
export type UpdateOnboardingInput = z.infer<typeof updateOnboardingSchema>;
