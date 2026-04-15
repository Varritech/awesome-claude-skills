"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoIcon } from "@/components/icons";

export default function OpenClawPage() {
  const [input, setInput] = useState("");

  return (
    <div className="min-h-screen bg-cf-page flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[640px] animate-[fadeUp_0.5s_ease-out]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-cf-orange to-cf-orange-dark flex items-center justify-center">
            <LogoIcon size={18} className="text-white" />
          </div>
          <span className="text-[20px] font-bold tracking-[-0.03em] italic font-heading">
            ConvergeFlow
          </span>
        </div>

        {/* Chat card */}
        <div className="bg-gradient-to-br from-[#1E1B10] to-cf-card rounded-[24px] p-9 mb-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 min-w-[40px] rounded-[14px] bg-cf-orange flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold mb-0.5 font-heading">OpenClaw — Done With You</h2>
              <p className="text-[11px] text-white/25">We handle everything. You just answer a few questions.</p>
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex flex-col gap-3 mb-7">
            {/* Bot message 1 */}
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-full bg-cf-orange flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4L12 12L4 20" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 4L20 12L12 20" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="bg-[#222228] rounded-[16px] rounded-tl-[4px] py-3.5 px-[18px] max-w-[400px]">
                <p className="text-[13px] text-white/60 leading-[1.6]">
                  Hey Jake! I&apos;m going to set everything up for you. Quick question — what kind of work does your company do?
                </p>
              </div>
            </div>

            {/* User message */}
            <div className="flex justify-end gap-2.5">
              <div className="bg-cf-orange rounded-[16px] rounded-tr-[4px] py-3.5 px-[18px] max-w-[400px]">
                <p className="text-[13px] text-white leading-[1.6]">
                  We do residential roofing in the Dallas area. Mainly shingle replacement and storm damage repairs.
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cf-orange to-[#FB923C] flex items-center justify-center flex-shrink-0 text-[11px] font-bold">
                JR
              </div>
            </div>

            {/* Bot message 2 */}
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-full bg-cf-orange flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4L12 12L4 20" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 4L20 12L12 20" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="bg-[#222228] rounded-[16px] rounded-tl-[4px] py-3.5 px-[18px] max-w-[400px]">
                <p className="text-[13px] text-white/60 leading-[1.6]">
                  Got it. I found 47 potential customers in Dallas who might need roofing work. I&apos;ll write the emails, set up your inbox, and start sending. Sound good?
                </p>
              </div>
            </div>
          </div>

          {/* Input row */}
          <div className="flex gap-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer..."
              className="flex-1 bg-[#222228] border-none rounded-[14px] py-3.5 px-[18px] text-sm text-white outline-none placeholder:text-white/35"
            />
            <button
              type="button"
              className="w-12 h-12 min-w-[48px] bg-cf-orange rounded-[14px] border-none flex items-center justify-center cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="text-[11px] text-white/[0.15] text-center mt-3">
            Or continue on WhatsApp — we&apos;ll text you there.
          </p>
        </div>

        {/* WhatsApp CTA */}
        <div className="text-center mb-6">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2.5 bg-[#22C55E] text-white text-sm font-bold py-3.5 px-8 rounded-[14px] border-none cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(34,197,94,0.3)] font-heading uppercase tracking-wide"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
            </svg>
            Connect on WhatsApp
          </button>
        </div>

        {/* Footer links */}
        <div className="text-center">
          <Link
            href="/dashboard"
            className="text-[13px] text-white/20 hover:text-white/50 transition-colors"
          >
            Skip to dashboard
          </Link>
          <div className="mt-4">
            <Link
              href="/onboarding/path"
              className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
            >
              Back
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}