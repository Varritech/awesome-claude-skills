import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/onboarding(.*)',
  '/api/webhooks/(.*)',
]);

const isDashboardRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/emails(.*)',
  '/customers(.*)',
  '/settings(.*)',
  '/styles(.*)',
  '/analytics(.*)',
  '/deliverability(.*)',
  '/help(.*)',
]);

export default clerkMiddleware((auth, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  if (isDashboardRoute(req)) {
    const { userId, sessionClaims } = auth();

    // Not signed in — protect (Clerk will redirect to sign-in)
    if (!userId) {
      auth().protect();
      return NextResponse.next();
    }

    // Signed in but onboarding not completed → redirect to onboarding
    const meta = sessionClaims?.publicMetadata as Record<string, unknown> | undefined;
    if (!meta?.onboardingCompleted) {
      const url = req.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
