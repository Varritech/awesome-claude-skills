"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input, Toggle, Skeleton } from "@/components/ui";
import { MailIcon } from "@/components/icons";
import { apiGet, apiPatch } from "@/lib/api-client";

interface InboxConnection {
  id: string;
  email: string;
  provider: string;
  status: "connected" | "pending" | "error";
}

interface DomainConnection {
  id: string;
  domain: string;
  status: "verified" | "pending" | "failed";
}

interface UserPreferences {
  emailNotifications?: boolean;
  autoFollowUp?: boolean;
  weeklyReport?: boolean;
}

interface UserPlanInfo {
  tier: string;
  emailLimitLabel: string;
  price: string;
}

interface UserProfile {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  company?: string;
  phone?: string;
  avatarInitials?: string;
  inboxes?: InboxConnection[];
  domains?: DomainConnection[];
  preferences?: UserPreferences;
  plan?: UserPlanInfo;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    company: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<UserProfile>("/api/user/profile")
      .then((data) => {
        if (cancelled) return;
        setProfile(data ?? null);
        setForm({
          fullName: data?.fullName ?? `${data?.firstName ?? ""} ${data?.lastName ?? ""}`.trim(),
          email: data?.email ?? "",
          company: data?.company ?? "",
          phone: data?.phone ?? "",
        });
      })
      .catch((err) => console.error("Failed to load profile", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await apiPatch<UserProfile>("/api/user/profile", form);
      setProfile(updated ?? profile);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = async (key: keyof UserPreferences, value: boolean) => {
    setProfile((prev) =>
      prev ? { ...prev, preferences: { ...prev.preferences, [key]: value } } : prev
    );
    try {
      await apiPatch("/api/user/profile", { preferences: { [key]: value } });
    } catch (err) {
      console.error("Failed to update preference", err);
    }
  };

  if (loading) {
    return (
      <>
        <Skeleton className="h-7 w-32 mb-7" />
        <Skeleton className="h-48 mb-5" rounded="lg" />
        <Skeleton className="h-36 mb-5" rounded="lg" />
        <Skeleton className="h-36 mb-5" rounded="lg" />
      </>
    );
  }

  const inboxes = profile?.inboxes ?? [];
  const domains = profile?.domains ?? [];
  const preferences = profile?.preferences ?? {};
  const plan = profile?.plan;
  const initials =
    profile?.avatarInitials ??
    (profile?.fullName ?? form.fullName)
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <>
      <h1 className="text-[22px] font-bold tracking-tight mb-7 font-heading">Settings</h1>

      {/* Profile */}
      <Card className="mb-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cf-orange to-[#FB923C] flex items-center justify-center text-lg font-bold shrink-0">
            {initials || "??"}
          </div>
          <div>
            <h3 className="text-[15px] font-bold font-heading">{profile?.fullName ?? (form.fullName || "Your Profile")}</h3>
            <p className="text-[12px] text-white/25">{profile?.email ?? form.email}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {editing ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-[var(--radius-button)] bg-cf-orange text-[13px] text-white hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 rounded-[var(--radius-button)] bg-white/[0.04] text-[13px] text-white/50 hover:bg-white/[0.08] transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] text-white/20 mb-1.5 block">Full Name</label>
            <Input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              disabled={!editing}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/20 mb-1.5 block">Email</label>
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={!editing}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/20 mb-1.5 block">Company</label>
            <Input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              disabled={!editing}
              placeholder="Your company"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/20 mb-1.5 block">Phone</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              disabled={!editing}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
      </Card>

      {/* Connected Inboxes */}
      <Card className="mb-5">
        <p className="text-sm font-bold mb-4 font-heading">Connected Inboxes</p>
        <div className="flex flex-col gap-3">
          {inboxes.length === 0 && (
            <p className="text-[12px] text-white/30">No inboxes connected yet.</p>
          )}
          {inboxes.map((inbox) => (
            <div key={inbox.id} className="flex items-center gap-3 py-2">
              <div className="w-9 h-9 rounded-[var(--radius-icon)] bg-cf-elevated flex items-center justify-center">
                <MailIcon size={16} className="text-white/40" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-medium">{inbox.email}</p>
                <p className="text-[11px] text-white/20">
                  {inbox.provider} &middot; {inbox.status === "connected" ? "Connected" : inbox.status === "pending" ? "Pending" : "Error"}
                </p>
              </div>
              <span
                className={`w-2 h-2 rounded-full ${
                  inbox.status === "connected"
                    ? "bg-cf-green"
                    : inbox.status === "pending"
                    ? "bg-cf-amber"
                    : "bg-red-400"
                }`}
              />
            </div>
          ))}
        </div>
        <button className="mt-4 px-4 py-2 rounded-[var(--radius-button)] bg-white/[0.04] text-[13px] text-white/50 hover:bg-white/[0.08] transition-colors">
          + Add Inbox
        </button>
      </Card>

      {/* Domains */}
      <Card className="mb-5">
        <p className="text-sm font-bold mb-4 font-heading">Sending Domains</p>
        <div className="flex flex-col gap-3">
          {domains.length === 0 && (
            <p className="text-[12px] text-white/30">No domains added yet.</p>
          )}
          {domains.map((domain) => (
            <div key={domain.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-[13px] font-medium">{domain.domain}</p>
                <p className="text-[11px] text-white/20">
                  {domain.status === "verified" ? "Verified" : domain.status === "pending" ? "Pending" : "Failed"}
                </p>
              </div>
              <span
                className={`text-[11px] px-2.5 py-1 rounded-[var(--radius-pill)] font-medium ${
                  domain.status === "verified"
                    ? "bg-cf-green/15 text-cf-green"
                    : domain.status === "pending"
                    ? "bg-cf-amber/15 text-cf-amber"
                    : "bg-red-500/15 text-red-400"
                }`}
              >
                {domain.status === "verified" ? "Verified" : domain.status === "pending" ? "Pending" : "Failed"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Toggles */}
      <Card className="mb-5">
        <p className="text-sm font-bold mb-4 font-heading">Preferences</p>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">Email notifications</p>
              <p className="text-[11px] text-white/20">Get notified when leads reply</p>
            </div>
            <Toggle
              checked={preferences.emailNotifications ?? false}
              onChange={(checked) => updatePreference("emailNotifications", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">Auto-follow up</p>
              <p className="text-[11px] text-white/20">Send follow-ups automatically after 3 days</p>
            </div>
            <Toggle
              checked={preferences.autoFollowUp ?? false}
              onChange={(checked) => updatePreference("autoFollowUp", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">Weekly report</p>
              <p className="text-[11px] text-white/20">Summary email every Monday</p>
            </div>
            <Toggle
              checked={preferences.weeklyReport ?? false}
              onChange={(checked) => updatePreference("weeklyReport", checked)}
            />
          </div>
        </div>
      </Card>

      {/* Plan */}
      <Card className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold font-heading">Your Plan</p>
          <a
            href="/settings/payments"
            className="text-[13px] text-cf-orange hover:opacity-80 transition-opacity"
          >
            Manage Plan
          </a>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-bold font-heading">{plan?.tier ?? "Free"}</p>
            <p className="text-[12px] text-white/25">{plan?.emailLimitLabel ?? "No plan"}</p>
          </div>
          <p className="text-[15px] font-bold font-mono">{plan?.price ?? "--"}</p>
        </div>
      </Card>

      {/* Danger zone */}
      <Card variant="elevated" className="border border-red-500/20">
        <p className="text-sm font-bold text-red-400 mb-3 font-heading">Danger Zone</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium">Delete Account</p>
            <p className="text-[11px] text-white/20">
              Permanently delete your account and all data
            </p>
          </div>
          <Button variant="danger" size="sm">
            Delete
          </Button>
        </div>
      </Card>
    </>
  );
}
