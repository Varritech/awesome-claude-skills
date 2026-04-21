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

export default clerkMiddleware((auth, req) => {
  // Explicit public routes always pass through.
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Guard protected routes — redirect unauthenticated users to /login.
  if (isProtectedRoute(req)) {
    auth().protect();
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
