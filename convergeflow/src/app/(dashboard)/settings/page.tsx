"use client";

import { Card, Button, Input, Toggle } from "@/components/ui";
import { MailIcon } from "@/components/icons";

export default function SettingsPage() {
  return (
    <>
      <h1 className="text-[22px] font-bold tracking-tight mb-7">Settings</h1>

      {/* Profile */}
      <Card className="mb-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cf-orange to-[#FB923C] flex items-center justify-center text-lg font-bold shrink-0">
            JR
          </div>
          <div>
            <h3 className="text-[15px] font-bold">Jake Robinson</h3>
            <p className="text-[12px] text-white/25">jake@convergeflow.io</p>
          </div>
          <button className="ml-auto px-4 py-2 rounded-[var(--radius-button)] bg-white/[0.04] text-[13px] text-white/50 hover:bg-white/[0.08] transition-colors">
            Edit
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] text-white/20 mb-1.5 block">Full Name</label>
            <Input placeholder="Jake Robinson" />
          </div>
          <div>
            <label className="text-[11px] text-white/20 mb-1.5 block">Email</label>
            <Input placeholder="jake@convergeflow.io" />
          </div>
          <div>
            <label className="text-[11px] text-white/20 mb-1.5 block">Company</label>
            <Input placeholder="ConvergeFlow" />
          </div>
          <div>
            <label className="text-[11px] text-white/20 mb-1.5 block">Phone</label>
            <Input placeholder="(555) 123-4567" />
          </div>
        </div>
      </Card>

      {/* Connected Inboxes */}
      <Card className="mb-5">
        <p className="text-sm font-bold mb-4">Connected Inboxes</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 py-2">
            <div className="w-9 h-9 rounded-[var(--radius-icon)] bg-cf-elevated flex items-center justify-center">
              <MailIcon size={16} className="text-white/40" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium">jake@convergeflow.io</p>
              <p className="text-[11px] text-white/20">Gmail &middot; Connected</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-cf-green" />
          </div>
          <div className="flex items-center gap-3 py-2">
            <div className="w-9 h-9 rounded-[var(--radius-icon)] bg-cf-elevated flex items-center justify-center">
              <MailIcon size={16} className="text-white/40" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium">jake@roofingdallas.com</p>
              <p className="text-[11px] text-white/20">Custom SMTP &middot; Connected</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-cf-green" />
          </div>
        </div>
        <button className="mt-4 px-4 py-2 rounded-[var(--radius-button)] bg-white/[0.04] text-[13px] text-white/50 hover:bg-white/[0.08] transition-colors">
          + Add Inbox
        </button>
      </Card>

      {/* Domains */}
      <Card className="mb-5">
        <p className="text-sm font-bold mb-4">Sending Domains</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-[13px] font-medium">roofingdallas.com</p>
              <p className="text-[11px] text-white/20">Verified</p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-[var(--radius-pill)] font-medium bg-cf-green/15 text-cf-green">
              Verified
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-[13px] font-medium">guttersftworth.com</p>
              <p className="text-[11px] text-white/20">Pending</p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-[var(--radius-pill)] font-medium bg-cf-amber/15 text-cf-amber">
              Pending
            </span>
          </div>
        </div>
      </Card>

      {/* Toggles */}
      <Card className="mb-5">
        <p className="text-sm font-bold mb-4">Preferences</p>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">Email notifications</p>
              <p className="text-[11px] text-white/20">Get notified when leads reply</p>
            </div>
            <Toggle defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">Auto-follow up</p>
              <p className="text-[11px] text-white/20">Send follow-ups automatically after 3 days</p>
            </div>
            <Toggle defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">Weekly report</p>
              <p className="text-[11px] text-white/20">Summary email every Monday</p>
            </div>
            <Toggle />
          </div>
        </div>
      </Card>

      {/* Plan */}
      <Card className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold">Your Plan</p>
          <a
            href="/settings/payments"
            className="text-[13px] text-cf-orange hover:opacity-80 transition-opacity"
          >
            Manage Plan
          </a>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-bold">Starter</p>
            <p className="text-[12px] text-white/25">50 emails/day</p>
          </div>
          <p className="text-[15px] font-bold">$49/mo</p>
        </div>
      </Card>

      {/* Danger zone */}
      <Card variant="elevated" className="border border-red-500/20">
        <p className="text-sm font-bold text-red-400 mb-3">Danger Zone</p>
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
