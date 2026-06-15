import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Public routes that do not require authentication.
 * Everything else under the protected prefixes below requires a signed-in user.
 */
const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/onboarding/signup(.*)',
  '/api/webhooks/(.*)',
  '/privacy',
  '/terms',
  '/data-deletion',
]);

/**
 * Protected route prefixes. Matches the authenticated areas of the app.
 * Note: `/onboarding/signup` is explicitly public above even though
 * `/onboarding(.*)` is listed here.
 */
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/emails(.*)',
  '/customers(.*)',
  '/settings(.*)',
  '/styles(.*)',
  '/analytics(.*)',
  '/deliverability(.*)',
  '/help(.*)',
  '/onboarding(.*)',
]);

/**
 * Onboarding routes that an already-onboarded user should never see again.
 * `/onboarding/signup` stays accessible because sign-up is the entry point for
 * brand-new sessions (and Clerk reuses it for post-signup redirects).
 */
const isOnboardingRoute = createRouteMatcher([
  '/onboarding',
  '/onboarding/path(.*)',
  '/onboarding/industry(.*)',
  '/onboarding/style(.*)',
  '/onboarding/domain(.*)',
  '/onboarding/inbox(.*)',
  '/onboarding/openclaw(.*)',
  '/onboarding/verify-email(.*)',
]);

export default clerkMiddleware((auth, req) => {
  // Explicit public routes always pass through.
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Guard protected routes — redirect unauthenticated users to /login.
  if (isProtectedRoute(req)) {
    auth().protect();
  }

  // Server-side session timeout: enforce 30-minute max session age.
  // Defense-in-depth complement to the client-side SessionTimeout component.
  const { sessionClaims } = auth();
  const iat = sessionClaims?.iat as number | undefined;
  if (iat && Date.now() / 1000 - iat > 1800) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Already-onboarded users should never land back in onboarding. The PATCH
  // /api/user/onboarding handler writes `publicMetadata.onboardingCompleted`
  // so the source of truth lives in the Clerk session claims here.
  const publicMetadata = (sessionClaims?.public_metadata ?? sessionClaims?.publicMetadata) as
    | { onboardingCompleted?: boolean }
    | undefined;
  if (publicMetadata?.onboardingCompleted && isOnboardingRoute(req)) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files unless found in search params.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
  ],
};
