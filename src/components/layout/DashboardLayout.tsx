"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { apiGet } from "@/lib/api-client";
import {
  HomeIcon,
  MailIcon,
  UsersIcon,
  PenIcon,
  ChartIcon,
  SettingsIcon,
  UserIcon,
  LogoIcon,
  HelpIcon,
  ShieldIcon,
  SendIcon,
} from "@/components/icons";
import { FeedbackWidget, SessionTimeout } from "@/components/ui";
import { NotificationBell } from "@/components/ui/NotificationBell";

// Inbox icon for Replies nav
function InboxIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

const navItems = [
  { href: "/dashboard", label: "Home", icon: HomeIcon, matchPrefix: false },
  { href: "/emails", label: "Emails", icon: MailIcon, matchPrefix: true },
  { href: "/campaigns", label: "Campaigns", icon: SendIcon, matchPrefix: true },
  { href: "/replies", label: "Replies", icon: InboxIcon, matchPrefix: true },
  { href: "/customers", label: "Customers", icon: UsersIcon, matchPrefix: true },
  { href: "/styles", label: "Styles", icon: PenIcon, matchPrefix: true },
  { href: "/analytics", label: "Analytics", icon: ChartIcon, matchPrefix: true },
  { href: "/deliverability", label: "Deliverability", icon: ShieldIcon, matchPrefix: true },
];

const bottomNavItems = [
  { href: "/dashboard", label: "Home", icon: HomeIcon, matchPrefix: false },
  { href: "/emails", label: "Emails", icon: MailIcon, matchPrefix: true },
  { href: "/campaigns", label: "Campaigns", icon: SendIcon, matchPrefix: true },
  { href: "/customers", label: "Customers", icon: UsersIcon, matchPrefix: true },
  { href: "/settings", label: "Account", icon: UserIcon, matchPrefix: true },
];

function isNavActive(pathname: string, href: string, matchPrefix: boolean) {
  if (matchPrefix) {
    return pathname === href || pathname.startsWith(href + "/");
  }
  return pathname === href;
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-[var(--sidebar-width)] bg-cf-card flex-col items-center py-4 shrink-0">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="w-9 h-9 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark flex items-center justify-center mb-7"
      >
        <LogoIcon size={16} className="text-white" />
      </Link>

      {/* Nav icons */}
      <nav className="flex flex-col gap-1">
        {navItems.map(({ href, icon: Icon, matchPrefix }) => {
          const isActive = isNavActive(pathname, href, matchPrefix);
          return (
            <Link
              key={href}
              href={href}
              className={`relative w-10 h-10 rounded-[var(--radius-icon)] flex items-center justify-center transition-colors duration-cf-fast hover:bg-white/[0.04] ${
                isActive ? "bg-cf-orange/10" : ""
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-[2px] bg-cf-orange" />
              )}
              <Icon
                size={18}
                className={isActive ? "text-cf-orange" : "text-white/20"}
              />
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Notification Bell */}
      <NotificationBell />

      {/* Help */}
      <Link
        href="/help"
        className={`relative w-10 h-10 rounded-[var(--radius-icon)] flex items-center justify-center transition-colors duration-cf-fast hover:bg-white/[0.04] mb-2 ${
          isNavActive(pathname, "/help", true) ? "bg-cf-orange/10" : ""
        }`}
      >
        {isNavActive(pathname, "/help", true) && (
          <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-[2px] bg-cf-orange" />
        )}
        <HelpIcon
          size={18}
          className={isNavActive(pathname, "/help", true) ? "text-cf-orange" : "text-white/20"}
        />
      </Link>

      {/* Settings */}
      <Link
        href="/settings"
        className={`relative w-10 h-10 rounded-[var(--radius-icon)] flex items-center justify-center transition-colors duration-cf-fast hover:bg-white/[0.04] mb-2 ${
          isNavActive(pathname, "/settings", true) ? "bg-cf-orange/10" : ""
        }`}
      >
        {isNavActive(pathname, "/settings", true) && (
          <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-[2px] bg-cf-orange" />
        )}
        <SettingsIcon
          size={18}
          className={isNavActive(pathname, "/settings", true) ? "text-cf-orange" : "text-white/20"}
        />
      </Link>

      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cf-orange to-[#FB923C] flex items-center justify-center text-xs font-bold cursor-pointer">
        JR
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[var(--mobile-nav-height)] bg-cf-card border-t border-white/[0.04] flex items-center justify-around z-50">
      {bottomNavItems.map(({ href, label, icon: Icon, matchPrefix }) => {
        const isActive = isNavActive(pathname, href, matchPrefix);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 ${isActive ? "text-cf-orange" : "text-white/35"}`}
          >
            <Icon size={20} />
            <span className="text-[11px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    apiGet<{ completed?: boolean }>("/api/user/onboarding")
      .then((state) => {
        if (!state?.completed) router.replace("/onboarding");
      })
      .catch(() => {});
  }, [isLoaded, isSignedIn, router]);

  return <>{children}</>;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cf-page flex">
      <Sidebar />
      <main className="flex-1 p-7 md:p-7 max-md:p-6 max-md:pb-[calc(var(--mobile-nav-height)+1rem)]">
        <div className="max-w-cf-content mx-auto">
          <OnboardingGuard>{children}</OnboardingGuard>
        </div>
      </main>
      <MobileNav />
      <FeedbackWidget />
      <SessionTimeout />
    </div>
  );
}