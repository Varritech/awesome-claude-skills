"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api-client";
import type { Notification } from "@/lib/notifications/types";

function BellIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
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
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

const TYPE_LABEL: Record<string, string> = {
  reply: "Reply",
  bounce: "Bounce",
  booking: "Booking",
};

const TYPE_COLOR: Record<string, string> = {
  reply: "text-cf-orange",
  bounce: "text-red-400",
  booking: "text-green-400",
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface NotificationsApiResponse {
  data: Notification[];
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    apiGet<NotificationsApiResponse>("/api/notifications")
      .then((res) => setNotifications(res?.data ?? []))
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markAsRead(id: string) {
    try {
      await apiPatch(`/api/notifications/${id}`, {});
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // silent fail
    }
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-[var(--radius-icon)] flex items-center justify-center transition-colors duration-cf-fast hover:bg-white/[0.04]"
        aria-label="Notifications"
      >
        <BellIcon size={18} className="text-white/20" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-cf-orange text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 w-80 bg-cf-card border border-white/[0.06] rounded-[var(--radius-card)] shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
            <span className="text-[13px] font-bold font-heading">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[11px] text-white/30">{unreadCount} unread</span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-white/25">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`px-4 py-3 border-b border-white/[0.03] cursor-pointer transition-colors hover:bg-white/[0.02] ${
                    !notif.read ? "bg-white/[0.02]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide ${TYPE_COLOR[notif.type] ?? "text-white/40"}`}
                    >
                      {TYPE_LABEL[notif.type] ?? notif.type}
                    </span>
                    <span className="text-[10px] text-white/20">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-[12px] text-white/70 leading-snug">{notif.message}</p>
                  {(notif.leadName || notif.campaignName) && (
                    <p className="text-[11px] text-white/30 mt-0.5">
                      {notif.leadName}
                      {notif.campaignName ? ` · ${notif.campaignName}` : ""}
                    </p>
                  )}
                  {!notif.read && (
                    <div className="w-1.5 h-1.5 rounded-full bg-cf-orange absolute right-3 top-3.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
