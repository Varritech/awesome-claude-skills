'use client';

import Image from 'next/image';
import Link from 'next/link';

// ─── Shared primitives ────────────────────────────────────────────────────────

function ArrowIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#E85002" strokeWidth="2.5" strokeLinecap="square">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="#E85002">
      <polygon points="12,2 15,9 22,9.5 17,14 18.5,22 12,18 5.5,22 7,14 2,9.5 9,9" />
    </svg>
  );
}

type BadgeVariant = 'green' | 'orange' | 'yellow' | 'red' | 'gray' | 'dark' | 'sand' | 'teal' | 'amethyst';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  green: 'bg-[#365E3D] text-white border-black',
  orange: 'bg-[#E85002] text-white border-black',
  yellow: 'bg-[#D49A36] text-[#050505] border-black',
  red: 'bg-[#A63C32] text-white border-black',
  gray: 'bg-white text-[#050505] border-black',
  dark: 'bg-[#050505] text-white border-black',
  sand: 'bg-[#D9C3AB] text-[#050505] border-black',
  teal: 'bg-[#2E4C54] text-white border-black',
  amethyst: 'bg-[#513C5E] text-white border-black',
};

function Badge({ variant, children, className = '' }: { variant: BadgeVariant; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-[Chivo] text-[11px] font-medium uppercase tracking-[0.06em] border px-[9px] py-1 rounded-full leading-none ${BADGE_STYLES[variant]} ${className}`}>
      {children}
    </span>
  );
}

function Dot({ className = '' }: { className?: string }) {
  return <span className={`w-[5px] h-[5px] rounded-full bg-current opacity-85 ${className}`} />;
}

function PulseOrb() {
  return <span className="inline-block w-[6px] h-[6px] rounded-full bg-white animate-pulse mr-0" />;
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-[#050505] border-b-2 border-black">
      <div className="max-w-[1320px] mx-auto flex items-center gap-8 px-8 py-3.5">
        <Link href="/" className="flex items-center gap-3 font-[Archivo] font-black italic text-[20px] tracking-[-0.04em] text-[#F9F9F9]">
          <Image src="/cf-logomark.png" alt="ConvergeFlow" width={26} height={26} className="h-[26px] w-auto" />
          <span>CONVERGEFLOW</span>
        </Link>
        <div className="hidden lg:flex gap-7 items-center">
          {['Product', 'Solutions', 'Resources'].map((item) => (
            <Link key={item} href="#" className="font-[Chivo] text-[13px] font-medium text-[#A7A7A7] hover:text-[#F9F9F9] flex items-center gap-1.5 transition-colors">
              {item}
              <span className="w-2 h-2 border-r-[1.5px] border-b-[1.5px] border-current rotate-45 -mt-0.5" />
            </Link>
          ))}
          <Link href="#pricing" className="font-[Chivo] text-[13px] font-medium text-[#A7A7A7] hover:text-[#F9F9F9] transition-colors">Pricing</Link>
          <Link href="#contact" className="font-[Chivo] text-[13px] font-medium text-[#A7A7A7] hover:text-[#F9F9F9] transition-colors">Contact</Link>
        </div>
        <div className="ml-auto flex gap-2.5 items-center">
          <Link href="/login" className="font-[Archivo] font-bold text-[13px] uppercase tracking-[0.06em] text-[#F9F9F9] px-1 py-2.5 hover:underline underline-offset-4">Log in</Link>
          <Link href="/onboarding/signup" className="inline-flex items-center gap-2 border border-black font-[Archivo] font-bold text-[13px] uppercase tracking-[0.06em] px-[18px] py-3 leading-none transition-all duration-180 bg-gradient-to-br from-black via-[#C10801] to-[#F16001] text-[#F9F9F9] shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_0_#000]">
            Start free <ArrowIcon />
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero Dashboard Mock ──────────────────────────────────────────────────────

function CampaignStatus({ status }: { status: string }) {
  if (status === 'live') return <Badge variant="orange" className="text-[9px]"><PulseOrb /> LIVE</Badge>;
  if (status === 'warming') return <Badge variant="yellow" className="text-[9px]">WARMING</Badge>;
  if (status === 'queued') return <Badge variant="teal" className="text-[9px]">QUEUED</Badge>;
  return <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] border px-[9px] py-1 rounded-full bg-[#1a1a1a] text-[#A7A7A7] border-[#333]">DRAFT</span>;
}

function NavIcon({ id }: { id: string }) {
  if (id === 'campaigns') return <><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2z"/></>;
  if (id === 'composer') return <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>;
  if (id === 'deliverability') return <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>;
  if (id === 'inbox') return <><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>;
  return <><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/></>;
}

function HeroDashboard() {
  const campaigns = [
    { name: 'Q2 Cold Outreach · SaaS Founders', statusKey: 'live', persona: 'DIRECT', sends: '4,128', reply: '9.2%', booked: '38', bookedAccent: true },
    { name: 'Agency Partner Re-engagement', statusKey: 'warming', persona: 'INDUSTRY', sends: '612', reply: '11.4%', booked: '8', bookedAccent: true },
    { name: 'Enterprise · Series B+', statusKey: 'queued', persona: 'EXECUTIVE', sends: '—', reply: '—', booked: '0', bookedAccent: false },
    { name: 'Holiday Discount Push', statusKey: 'draft', persona: '—', sends: '—', reply: '—', booked: '0', bookedAccent: false },
  ];

  return (
    <div className="bg-[#050505] border-2 border-black shadow-[4px_4px_0_0_#000] text-[#F9F9F9]">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#333] bg-[#050505]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#A63C32] border border-[#050505]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#D49A36] border border-[#050505]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#365E3D] border border-[#050505]" />
        </div>
        <div className="flex-1 font-mono text-[11px] text-[#A7A7A7] text-center tracking-[0.08em]">app.convergeflow.com / workspace / acme.io</div>
        <div className="font-mono text-[10px] text-[#646464] tracking-[0.1em]">LIVE</div>
      </div>
      <div className="grid grid-cols-[200px_1fr] min-h-[520px]">
        {/* Sidebar */}
        <aside className="border-r border-[#333] p-[18px_14px] flex flex-col gap-[18px]">
          <div className="flex items-center gap-2.5 font-[Archivo] font-black italic text-[14px] tracking-[-0.03em]">
            <Image src="/cf-logomark.png" alt="" width={18} height={18} className="h-[18px] w-auto" />
            <span>CONVERGEFLOW</span>
          </div>
          <div>
            <div className="font-mono text-[10px] text-[#646464] uppercase tracking-[0.16em] px-2.5">WORKSPACE</div>
            <nav className="flex flex-col gap-0.5 mt-2">
              {[
                { label: 'Campaigns', active: true, iconId: 'campaigns' },
                { label: 'AI Composer', active: false, iconId: 'composer' },
                { label: 'Deliverability', active: false, iconId: 'deliverability' },
                { label: 'Inbox', active: false, iconId: 'inbox' },
                { label: 'Leads', active: false, iconId: 'leads' },
              ].map(({ label, active, iconId }) => (
                <a key={label} href="#" className={`flex items-center gap-2.5 px-2.5 py-2 font-[Chivo] text-[12px] border transition-colors ${active ? 'bg-[#E85002] text-white border-black shadow-[2px_2px_0_0_#000]' : 'text-[#A7A7A7] border-transparent hover:text-[#F9F9F9]'}`}>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><NavIcon id={iconId} /></svg>
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <div className="mt-auto border-t border-[#333] pt-3.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#D9C3AB] border border-[#050505] flex items-center justify-center font-[Archivo] font-black text-[#050505] text-[12px]">JM</div>
            <div>
              <div className="font-[Archivo] font-bold text-[12px] text-[#F9F9F9]">Jamie M.</div>
              <div className="font-mono text-[10px] text-[#646464] tracking-[0.1em] uppercase">ACME.IO</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[11px] text-[#A7A7A7] tracking-[0.14em] uppercase">WORKSPACE / ACME.IO</div>
              <div className="font-[Archivo] font-extrabold text-[22px] tracking-[-0.01em] mt-1.5">
                Campaigns <span className="font-mono font-normal text-[12px] text-[#A7A7A7] tracking-[0.1em]">· 7 DAYS</span>
              </div>
            </div>
            <Badge variant="orange" className="text-[10px]"><PulseOrb /> LIVE</Badge>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {[
              { lbl: 'SENDS', val: '4,740', dlt: '▲ +14.2%', accent: false },
              { lbl: 'REPLY RATE', val: '9.6%', dlt: '▲ +1.8 pt', accent: false },
              { lbl: 'BOOKED CALLS', val: '46', dlt: '▲ +12', accent: true },
              { lbl: 'DELIVERABILITY', val: '98', dlt: '▲ +2', accent: false, suffix: '/100' },
            ].map(({ lbl, val, dlt, accent, suffix }) => (
              <div key={lbl} className="border border-[#333] p-3 bg-[#0c0c0c]">
                <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#A7A7A7]">{lbl}</div>
                <div className={`font-mono font-medium text-[24px] tracking-[-0.02em] mt-1.5 ${accent ? 'text-[#E85002]' : 'text-[#F9F9F9]'}`}>
                  {val}{suffix && <span className="text-[#646464] text-[18px]">{suffix}</span>}
                </div>
                <div className="font-mono text-[10px] text-[#365E3D] mt-1 tracking-[0.04em]">{dlt}</div>
              </div>
            ))}
          </div>

          <div className="border border-[#333]">
            <div className="grid grid-cols-[1.7fr_90px_1fr_0.7fr_0.7fr_0.7fr] px-3.5 py-3 gap-2.5 bg-[#1a1a1a] border-b border-[#333] font-mono text-[10px] tracking-[0.14em] text-[#A7A7A7] uppercase">
              <div>CAMPAIGN</div><div>STATUS</div><div>PERSONA</div>
              <div className="text-right">SENDS</div><div className="text-right">REPLY</div><div className="text-right">BOOKED</div>
            </div>
            {campaigns.map((c) => (
              <div key={c.name} className="grid grid-cols-[1.7fr_90px_1fr_0.7fr_0.7fr_0.7fr] px-3.5 py-3 gap-2.5 border-b border-[#1a1a1a] last:border-0 items-center text-[12px]">
                <div className="font-[Archivo] font-bold text-[13px] text-[#F9F9F9]">{c.name}</div>
                <div><CampaignStatus status={c.statusKey} /></div>
                <div className="font-mono text-[11px] text-[#A7A7A7]">{c.persona}</div>
                <div className="font-mono text-[12px] text-[#F9F9F9] text-right">{c.sends}</div>
                <div className="font-mono text-[12px] text-[#F9F9F9] text-right">{c.reply}</div>
                <div className={`font-mono text-[12px] text-right font-bold ${c.bookedAccent ? 'text-[#E85002]' : 'text-[#646464]'}`}>{c.booked}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="bg-[#F9F9F9] pt-[72px] pb-24 border-b-2 border-black relative overflow-hidden">
      <div className="max-w-[1320px] mx-auto px-8 grid grid-cols-[1.05fr_1fr] gap-16 items-center lg:grid-cols-1 lg:gap-8">
        <div>
          <div className="mb-[18px]">
            <Badge variant="dark"><Dot /> BUILT FOR FOUNDERS &amp; AGENCIES</Badge>
          </div>
          <h1 className="font-[Archivo] font-black text-[96px] lg:text-[72px] leading-[0.96] tracking-[-0.03em] mb-[22px] mt-[18px]">
            <span className="block">
              <span className="inline-block text-[#A7A7A7] text-[calc(96px*0.32)] font-bold line-through decoration-[#E85002] decoration-4 uppercase tracking-normal align-middle mr-3.5">Cold email is broken.</span>
            </span>
            <span className="block">5 clicks to a</span>
            <span className="block">booked <span className="text-[#E85002]">call.</span></span>
          </h1>
          <p className="font-[Chivo] text-[18px] text-[#333333] max-w-[48ch] mb-7 leading-[1.55]">
            Set up in minutes, protect your domain, and focus on closing deals — no technical skills required. Stop measuring vanity replies. Measure meetings on the calendar.
          </p>
          <div className="flex gap-4 items-center flex-wrap mb-8">
            <Link href="/onboarding/signup" className="inline-flex items-center gap-2 border border-black font-[Archivo] font-bold text-[13px] uppercase tracking-[0.06em] px-[18px] py-3 leading-none bg-gradient-to-br from-black via-[#C10801] to-[#F16001] text-[#F9F9F9] shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
              Start free <ArrowIcon />
            </Link>
            <Link href="#" className="inline-flex items-center gap-2 border border-black font-[Archivo] font-bold text-[13px] uppercase tracking-[0.06em] px-[18px] py-3 leading-none bg-[#F9F9F9] text-[#050505] shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
              Book a demo
            </Link>
            <span className="font-mono text-[11px] text-[#646464] uppercase tracking-[0.16em]">NO CREDIT CARD · 14-DAY TRIAL</span>
          </div>
          <div className="flex items-center gap-3.5 border-t border-black pt-5 mb-9">
            <div className="flex gap-0.5">{[1,2,3,4,5].map((i) => <StarIcon key={i} />)}</div>
            <span className="font-[Archivo] font-black text-[18px] tracking-[-0.04em]">4.9/5</span>
            <span className="font-mono text-[11px] text-[#646464] uppercase tracking-[0.12em]">328 TRUSTPILOT REVIEWS</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#646464]">SPF · PASS</span>
            <span className="flex-1 h-px bg-black" />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#646464]">DKIM · VERIFIED</span>
            <span className="flex-1 h-px bg-black" />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#646464]">DMARC · ACTIVE</span>
          </div>
        </div>
        <div className="lg:order-first">
          <HeroDashboard />
        </div>
      </div>
    </section>
  );
}

// ─── Logo Rail ────────────────────────────────────────────────────────────────

const LOGOS = ['STRETTO', 'HELMSMAN', 'GRIDFORGE', 'ATLASWORKS', 'NORTHBEAM', 'BOXFOLD', 'APEXROW', 'RIDGELINE', 'KILNMARK', 'DUOPILOT'];

function LogoRail() {
  const doubled = [...LOGOS, ...LOGOS];
  return (
    <section className="bg-[#050505] text-[#F9F9F9] py-[34px] border-b-2 border-black overflow-hidden">
      <div className="flex items-center gap-3.5 justify-center mb-[18px]">
        <span className="w-8 h-px bg-[#646464]" />
        <span className="font-mono text-[11px] text-[#A7A7A7] uppercase tracking-[0.2em]">TRUSTED BY 300+ B2B FOUNDERS &amp; AGENCIES</span>
        <span className="w-8 h-px bg-[#646464]" />
      </div>
      <div className="[mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] [-webkit-mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className="flex gap-12 animate-[marquee_32s_linear_infinite] w-max">
          {doubled.map((name, i) => (
            <span key={i} className="font-[Archivo] font-black text-[22px] tracking-[-0.03em] text-[#A7A7A7] uppercase whitespace-nowrap">{name}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Panel chrome ─────────────────────────────────────────────────────────────

function PanelHead({ crumb, right }: { crumb: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-black font-mono text-[11px] tracking-[0.12em] uppercase">
      <div className="flex items-center gap-2 font-[Archivo] italic font-black text-[13px] tracking-[-0.03em] normal-case">
        <Image src="/cf-logomark.png" alt="" width={14} height={14} className="h-[14px] w-auto" />
        CONVERGEFLOW
      </div>
      <span className="text-[#646464]">{crumb}</span>
      {right && <div className="ml-auto flex gap-2 items-center">{right}</div>}
    </div>
  );
}

function AiCard({ steps, title, sub, output }: { steps: string[]; title: string; sub: string; output: React.ReactNode }) {
  return (
    <div className="bg-[#050505] text-[#F9F9F9] border border-[#050505] p-[18px]">
      <div className="flex items-center gap-2 mb-3.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E85002" strokeWidth="2">
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
        </svg>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#E85002]">{title}</span>
        <span className="font-mono text-[10px] text-[#A7A7A7] tracking-[0.08em] ml-auto">{sub}</span>
      </div>
      {steps.map((s, i) => (
        <div key={i} className={`flex items-center gap-2.5 py-2 font-mono text-[12px] border-b border-[#1a1a1a] last:border-0 ${i < steps.length - 1 ? 'text-[#F9F9F9]' : 'text-[#E85002]'}`}>
          <span className={`w-3.5 h-3.5 border flex-shrink-0 flex items-center justify-center text-[10px] ${i < steps.length - 1 ? 'bg-[#365E3D] border-[#365E3D]' : 'border-[#E85002] bg-transparent'}`}>
            {i < steps.length - 1 ? '✓' : ''}
          </span>
          {s}
        </div>
      ))}
      <div className="mt-3.5 border-t border-[#333] pt-3.5">{output}</div>
    </div>
  );
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1Panel() {
  return (
    <div className="border-2 border-black shadow-[4px_4px_0_0_#000] bg-[#F9F9F9]">
      <PanelHead crumb="/ ONBOARDING" right={<span className="font-mono text-[11px] text-[#646464] uppercase tracking-[0.12em]">STEP 2 OF 3</span>} />
      <div className="p-5 grid grid-cols-[1.1fr_1fr] gap-4">
        <div>
          {[
            { lbl: 'COMPANY NAME', val: 'Acme Solutions Inc.', type: 'text' },
            { lbl: 'INDUSTRY', val: 'SaaS · Series A → C', type: 'text' },
          ].map(({ lbl, val }) => (
            <div key={lbl} className="flex flex-col gap-2 mb-3.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#646464]">{lbl}</div>
              <div className="border border-black bg-white px-3.5 py-[11px] font-[Chivo] text-[14px]">{val}</div>
            </div>
          ))}
          <div className="flex flex-col gap-2 mb-3.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#646464]">TARGET AUDIENCE</div>
            <div className="flex gap-1.5 flex-wrap">
              {['FOUNDERS', 'VP SALES', 'DIRECTORS', 'CTO'].map((t) => (
                <span key={t} className={`inline-flex items-center gap-1.5 border border-black font-[Chivo] text-[11px] uppercase tracking-[0.06em] font-medium px-2.5 py-1.5 ${t === 'FOUNDERS' ? 'bg-[#050505] text-white shadow-[2px_2px_0_0_#E85002]' : 'bg-white'}`}>{t}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 mb-3.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#646464]">WEBSITE</div>
            <div className="border border-black bg-white px-3.5 py-[11px] font-mono text-[13px] flex items-center justify-between">
              acmesolutions.com
              <Badge variant="green" className="text-[9px]">VERIFIED</Badge>
            </div>
          </div>
          <div className="flex gap-2 mt-[18px]">
            <button className="inline-flex items-center gap-2 border border-black font-[Archivo] font-bold text-[11px] uppercase tracking-[0.06em] px-3 py-2 leading-none bg-[#F9F9F9] text-[#050505] shadow-[2px_2px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all">← BACK</button>
            <button className="inline-flex items-center gap-2 border border-black font-[Archivo] font-bold text-[11px] uppercase tracking-[0.06em] px-3 py-2 leading-none bg-gradient-to-br from-black via-[#C10801] to-[#F16001] text-[#F9F9F9] shadow-[2px_2px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
              CONTINUE <ArrowIcon />
            </button>
          </div>
        </div>
        <AiCard
          title="CONVERGEFLOW AI"
          sub="RESEARCHING"
          steps={['Scanned acmesolutions.com', 'Extracted ICP signals', 'Identified target market', 'Pulled competitor positioning', 'Drafting sequence skeletons…']}
          output={
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#A7A7A7] mb-2">GENERATED ICP</div>
              <div className="flex flex-wrap gap-1">
                {['CTO', 'VP ENG', 'HEAD OF PRODUCT', 'SERIES A–C', '50–500 EMP', 'USA / EU'].map((c) => (
                  <span key={c} className="font-[Chivo] text-[11px] uppercase tracking-[0.06em] font-medium px-2.5 py-1.5 bg-[#0c0c0c] text-[#F9F9F9] border border-[#333]">{c}</span>
                ))}
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}

// ─── Step 2 Panel ─────────────────────────────────────────────────────────────

function Step2Panel() {
  const inboxes = [
    { email: 'jamie@outreach-acme.io', day: 28, score: 96, status: <Badge variant="green" className="text-[9px]">READY</Badge>, scoreColor: 'text-[#365E3D]' },
    { email: 'jamie@mail-acme.io', day: 19, score: 82, status: <Badge variant="yellow" className="text-[9px]">WARMING</Badge>, scoreColor: 'text-[#F9F9F9]' },
    { email: 'jamie@send-acme.io', day: 12, score: 67, status: <Badge variant="yellow" className="text-[9px]">WARMING</Badge>, scoreColor: 'text-[#F9F9F9]' },
    { email: 'jamie@reach-acme.io', day: 6, score: 41, status: <Badge variant="yellow" className="text-[9px]">WARMING</Badge>, scoreColor: 'text-[#F9F9F9]' },
    { email: 'jamie@go-acme.io', day: 2, score: 23, status: <Badge variant="gray" className="text-[9px]">STARTING</Badge>, scoreColor: 'text-[#F9F9F9]' },
  ];
  const bars = [8, 14, 22, 30, 42, 54, 62, 72, 84, 96];
  const labels = ['D1','D3','D5','D7','D10','D14','D18','D21','D25','D28'];

  return (
    <div className="border-2 border-black shadow-[4px_4px_0_0_#000] bg-[#F9F9F9]">
      <PanelHead crumb="/ DELIVERABILITY / WARMUP" right={
        <>
          <Badge variant="orange" className="text-[9px]">5 INBOXES</Badge>
          <button className="inline-flex items-center gap-1.5 border border-black font-[Archivo] font-bold text-[11px] uppercase tracking-[0.06em] px-3 py-2 leading-none bg-[#F9F9F9] text-[#050505] shadow-[2px_2px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] transition-all">+ ADD ACCOUNT</button>
        </>
      } />
      <div className="p-5">
        <div className="border border-black">
          <div className="grid grid-cols-[1.6fr_70px_60px_90px] gap-2.5 px-3.5 py-2.5 bg-[#050505] text-[#A7A7A7] font-mono text-[10px] uppercase tracking-[0.12em]">
            <div>EMAIL ADDRESS</div><div className="text-right">DAY</div><div className="text-right">SCORE</div><div className="text-right">STATUS</div>
          </div>
          {inboxes.map((r) => (
            <div key={r.email} className="grid grid-cols-[1.6fr_70px_60px_90px] gap-2.5 px-3.5 py-2.5 border-t border-black items-center">
              <div className="font-[Chivo] text-[12px] font-medium text-[#050505]">{r.email}</div>
              <div className="font-mono text-[11px] text-right">{r.day}</div>
              <div className={`font-mono text-[11px] font-bold text-right ${r.scoreColor}`}>{r.score}</div>
              <div className="flex justify-end">{r.status}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3.5">
          {[
            { lbl: 'AVG SCORE', val: '62', suffix: '/100', bg: '' },
            { lbl: 'READY', val: '1', suffix: '/5', bg: '', accent: true },
            { lbl: 'COST', val: '$17.50', suffix: '/MO', bg: 'bg-[#D9C3AB]' },
          ].map(({ lbl, val, suffix, bg, accent }) => (
            <div key={lbl} className={`border border-black p-3 ${bg}`}>
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#646464]">{lbl}</div>
              <div className={`font-mono text-[28px] tracking-[-0.02em] mt-1 ${accent ? 'text-[#E85002]' : ''}`}>
                {val}<span className="text-[14px] text-[#646464]">{suffix}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3.5 border border-black p-3.5 bg-[#050505] text-[#F9F9F9]">
          <div className="flex justify-between items-center mb-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#E85002]">GRADUAL WARMUP · 28-DAY RAMP</span>
            <Badge variant="green" className="text-[9px]">ON TRACK</Badge>
          </div>
          <div className="flex gap-0.5 items-end h-20 py-2">
            {bars.map((h, i) => (
              <span key={i} className="flex-1 border border-[#050505] border-b-0" style={{ height: `${h}%`, background: i < 5 ? '#E85002' : i === 5 ? '#F9F9F9' : '#333' }} />
            ))}
          </div>
          <div className="flex justify-between font-mono text-[9px] text-[#646464] tracking-[0.12em] mt-1">
            {labels.map((l) => <span key={l}>{l}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3 Panel ─────────────────────────────────────────────────────────────

function Step3Panel() {
  const leads = [
    { initials: 'SC', bg: 'bg-[#707653]', color: 'text-white', name: 'Sarah Chen', role: 'CEO', co: 'TechFlow AI', email: 's.chen@techflow.ai', rev: '$4.2M', size: '45' },
    { initials: 'JM', bg: 'bg-[#2E4C54]', color: 'text-white', name: 'James Miller', role: 'VP SALES', co: 'GrowthStack', email: 'james@growthstack.io', rev: '$12M', size: '120' },
    { initials: 'LP', bg: 'bg-[#513C5E]', color: 'text-white', name: 'Lisa Park', role: 'FOUNDER', co: 'DataSync', email: 'lisa@datasync.co', rev: '$2.1M', size: '18', highlight: true },
    { initials: 'MT', bg: 'bg-[#646464]', color: 'text-white', name: 'Mark Torres', role: 'CRO', co: 'ScaleUp HQ', email: 'm.torres@scaleup.com', rev: '$8.5M', size: '85' },
    { initials: 'DR', bg: 'bg-[#D9C3AB]', color: 'text-[#050505]', name: 'Diana Reyes', role: 'CEO', co: 'NovaBridge', email: 'd.reyes@novabridge.io', rev: '$6.3M', size: '62' },
  ];

  return (
    <div className="border-2 border-black shadow-[4px_4px_0_0_#000] bg-[#F9F9F9]">
      <PanelHead crumb="/ LEAD SEARCH" right={<span className="font-mono text-[11px] text-[#646464] uppercase tracking-[0.12em]">12,847 RESULTS</span>} />
      <div className="p-5">
        <div className="border border-black bg-white px-3.5 py-[11px] font-mono text-[13px] flex items-center justify-between mb-3">
          <span><span className="text-[#646464] mr-2">⌕</span>Search 325M+ leads…</span>
          <Badge variant="dark" className="text-[9px]">⌘ K</Badge>
        </div>
        <div className="flex gap-1.5 flex-wrap mb-3.5">
          <span className="font-mono text-[11px] text-[#646464] uppercase tracking-[0.14em] mr-1.5">FILTERS:</span>
          {['SAAS', 'CEO / FOUNDER', 'USA'].map((f) => (
            <span key={f} className="font-[Chivo] text-[11px] uppercase tracking-[0.06em] font-medium px-2.5 py-1.5 bg-[#050505] text-white border border-black shadow-[2px_2px_0_0_#E85002]">{f}</span>
          ))}
          {['10–200 EMP', '+3 MORE'].map((f) => (
            <span key={f} className="font-[Chivo] text-[11px] uppercase tracking-[0.06em] font-medium px-2.5 py-1.5 bg-white border border-black">{f}</span>
          ))}
        </div>
        <div className="border border-black">
          <div className="grid grid-cols-[1.6fr_1.2fr_1.4fr_0.7fr_0.5fr] gap-3 px-3.5 py-2.5 bg-[#050505] text-[#A7A7A7] font-mono text-[10px] uppercase tracking-[0.12em]">
            <div>CONTACT</div><div>COMPANY</div><div>EMAIL</div><div className="text-right">REV</div><div className="text-right">SIZE</div>
          </div>
          {leads.map((l) => (
            <div key={l.name} className={`grid grid-cols-[1.6fr_1.2fr_1.4fr_0.7fr_0.5fr] gap-3 px-3.5 py-2.5 border-t border-black items-center text-[13px] ${l.highlight ? 'bg-[#D9C3AB]' : ''}`}>
              <div className="flex gap-2.5 items-center">
                <div className={`w-[30px] h-[30px] ${l.bg} ${l.color} border border-[#050505] rounded-full flex-shrink-0 flex items-center justify-center font-[Archivo] font-black text-[11px]`}>{l.initials}</div>
                <div>
                  <div className="font-[Archivo] font-semibold text-[13px]">{l.name}</div>
                  <div className="font-mono text-[10px] text-[#646464] uppercase tracking-[0.08em]">{l.role}</div>
                </div>
              </div>
              <div>
                <div className="font-semibold">{l.co}</div>
                <div className="font-mono text-[10px] text-[#365E3D] uppercase tracking-[0.1em]">VERIFIED</div>
              </div>
              <div className="font-mono text-[11px] text-[#333333]">{l.email}</div>
              <div className="font-mono text-[11px] text-right text-[#333333]">{l.rev}</div>
              <div className="font-mono text-[11px] text-right text-[#333333]">{l.size}</div>
            </div>
          ))}
        </div>
        <div className="mt-3.5 p-3.5 border border-black bg-[#050505] text-[#F9F9F9] grid grid-cols-[auto_1fr_auto] gap-3.5 items-center">
          <div className="w-[42px] h-[42px] bg-[#707653] text-white border border-[#050505] rounded-full flex items-center justify-center font-[Archivo] font-black text-[14px]">SC</div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-[Archivo] font-bold text-[15px]">Sarah Chen · CEO at TechFlow AI</span>
              <Badge variant="green" className="text-[9px]">VERIFIED</Badge>
            </div>
            <div className="font-mono text-[10px] text-[#A7A7A7] mt-1 tracking-[0.06em]">BUYING SIGNALS: SERIES A · HIRING 3 SDRs · USES OUTREACH.IO</div>
          </div>
          <button className="inline-flex items-center gap-2 border border-black font-[Archivo] font-bold text-[11px] uppercase tracking-[0.06em] px-3 py-2 leading-none bg-gradient-to-br from-black via-[#C10801] to-[#F16001] text-[#F9F9F9] shadow-[2px_2px_0_0_#000]">PULL LEAD</button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4 Panel ─────────────────────────────────────────────────────────────

function Step4Panel() {
  const seq = [
    { n: 1, day: 'DAY 0', subj: 'Quick one — is {{first_name}} the right person?', status: <Badge variant="green" className="text-[9px]">SENT</Badge> },
    { n: 2, day: 'DAY 3', subj: 'Re: booked call vs. cold inbox', status: <Badge variant="green" className="text-[9px]">SENT</Badge> },
    { n: 3, day: 'DAY 7', subj: '{{company}} + ConvergeFlow — worth 15 min?', status: <Badge variant="yellow" className="text-[9px]">SENDING</Badge> },
    { n: 4, day: 'DAY 14', subj: 'Closing the loop — 30 sec read', status: <Badge variant="gray" className="text-[9px]">SCHEDULED</Badge> },
  ];

  return (
    <div className="border-2 border-black shadow-[4px_4px_0_0_#000] bg-[#F9F9F9]">
      <PanelHead crumb="/ CAMPAIGN BUILDER" right={<Badge variant="orange" className="text-[9px]">A/B TEST ACTIVE</Badge>} />
      <div className="p-5 grid grid-cols-[1fr_0.95fr] gap-4">
        <div>
          <div className="mb-3">
            <div className="font-[Archivo] font-extrabold text-[18px]">SaaS Founders · Q2 Outreach</div>
            <div className="font-mono text-[10px] text-[#646464] uppercase tracking-[0.1em] mt-1">4-STEP SEQUENCE · 847 PROSPECTS · 3 INBOXES</div>
          </div>
          <div className="border border-black">
            {seq.map((s) => (
              <div key={s.n} className="grid grid-cols-[32px_60px_1fr_90px] gap-3.5 px-4 py-3.5 border-b border-black last:border-0 items-center">
                <div className="w-8 h-8 border border-black flex items-center justify-center font-[Archivo] font-black text-[13px] bg-white">{s.n}</div>
                <div className="font-mono text-[11px] text-[#646464] uppercase tracking-[0.1em]">{s.day}</div>
                <div className="font-[Archivo] font-semibold text-[14px]">{s.subj}</div>
                {s.status}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2.5 mt-3.5">
            {[
              { v: '1,247', l: 'SENT', dark: false },
              { v: '68%', l: 'OPENED', dark: false },
              { v: '12%', l: 'REPLIED', dark: false },
              { v: '34', l: 'BOOKED', dark: true },
            ].map(({ v, l, dark }) => (
              <div key={l} className={`border border-black p-2.5 text-center ${dark ? 'bg-[#050505]' : ''}`}>
                <div className={`font-mono text-[18px] font-medium ${dark ? 'text-[#E85002]' : ''}`}>{v}</div>
                <div className={`font-mono text-[10px] uppercase tracking-[0.14em] mt-0.5 ${dark ? 'text-[#D9C3AB]' : 'text-[#646464]'}`}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <AiCard
          title="AI PERSONALIZATION"
          sub="SARAH CHEN"
          steps={['Scraped prospect website', 'Analyzed LinkedIn activity', 'Found Series A funding news', 'Identified hiring pain', 'Writing opener…']}
          output={
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#A7A7A7]">GENERATED EMAIL</span>
                <button className="font-mono text-[9px] text-[#E85002] uppercase tracking-[0.12em]">REGENERATE</button>
              </div>
              <p className="font-[Chivo] text-[13px] leading-[1.55] text-[#D9C3AB] italic">
                &ldquo;Hi Sarah — congrats on TechFlow&rsquo;s Series A. Scaling a 45-person AI team is no small feat. Noticed you&rsquo;re hiring 3 SDRs — we help teams like yours book 38 calls in 30 days without expanding headcount…&rdquo;
              </p>
              <div className="flex gap-2 mt-3 border-t border-[#333] pt-2.5">
                <Badge variant="orange" className="text-[9px]">PERSONALIZATION: 93%</Badge>
                <Badge variant="green" className="text-[9px]">3 SIGNALS</Badge>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}

// ─── Step 5 Panel ─────────────────────────────────────────────────────────────

function Step5Panel() {
  const replies = [
    { initials: 'SL', bg: 'bg-[#707653] text-white', name: 'Sarah Liu', co: 'STRETTO', preview: 'Re: Quick one — yes, can we schedule a call this Thursday?', badge: <Badge variant="orange" className="text-[9px]">CALL BOOKED</Badge>, time: '2m', highlight: true },
    { initials: 'MW', bg: 'bg-[#2E4C54] text-white', name: 'Marcus Wei', co: 'HELMSMAN', preview: 'Re: Closing the loop — Thursday at 3pm works perfectly.', badge: <Badge variant="orange" className="text-[9px]">CALL BOOKED</Badge>, time: '8m', highlight: false },
    { initials: 'AR', bg: 'bg-[#513C5E] text-white', name: 'Alex Rivera', co: 'NOVATECH', preview: 'Re: Pricing and integrations question — send me details please.', badge: <Badge variant="green" className="text-[9px]">INTERESTED</Badge>, time: '23m', highlight: false },
    { initials: 'EW', bg: 'bg-[#D9C3AB] text-[#050505]', name: 'Emily Watson', co: 'CLOUDBASE', preview: 'Re: Not the right time for us — ping me Q4.', badge: <Badge variant="gray" className="text-[9px]">NOT NOW</Badge>, time: '1h', highlight: false },
    { initials: 'DL', bg: 'bg-[#646464] text-white', name: 'David Liu', co: 'METRIC LABS', preview: 'Re: Out of office until Monday — will respond then.', badge: <Badge variant="yellow" className="text-[9px]">OOO</Badge>, time: '2h', highlight: false },
  ];

  return (
    <div className="border-2 border-black shadow-[4px_4px_0_0_#000] bg-[#F9F9F9]">
      <PanelHead crumb="/ INBOX" right={
        <div className="flex gap-1.5">
          {['ALL', 'INTERESTED', 'BOOKED'].map((f, i) => (
            <span key={f} className={`font-[Chivo] text-[10px] uppercase tracking-[0.06em] font-medium px-2.5 py-1.5 border border-black ${i === 0 ? 'bg-[#050505] text-white shadow-[2px_2px_0_0_#E85002]' : 'bg-white'}`}>{f}</span>
          ))}
        </div>
      } />
      <div>
        {replies.map((r) => (
          <div key={r.name} className={`grid grid-cols-[auto_1fr_auto_auto] gap-3.5 px-4 py-3.5 border-b border-black items-center ${r.highlight ? 'bg-[#D9C3AB]' : ''}`}>
            <div className={`w-9 h-9 ${r.bg} border border-[#050505] rounded-full flex-shrink-0 flex items-center justify-center font-[Archivo] font-black text-[12px]`}>{r.initials}</div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-[Archivo] font-bold text-[14px]">{r.name}</span>
                <span className="font-mono text-[10px] text-[#646464] uppercase tracking-[0.1em]">{r.co}</span>
              </div>
              <div className="font-[Chivo] text-[13px] text-[#333333] mt-0.5">{r.preview}</div>
            </div>
            {r.badge}
            <span className="font-mono text-[11px] text-[#646464]">{r.time}</span>
          </div>
        ))}
        <div className="px-4 py-3.5 bg-[#050505] text-[#F9F9F9] flex items-center gap-3.5">
          <div className="w-[38px] h-[38px] bg-[#707653] text-white border border-[#050505] rounded-full flex-shrink-0 flex items-center justify-center font-[Archivo] font-black text-[13px]">SL</div>
          <div className="flex-1">
            <div className="font-[Archivo] font-bold text-[13px]">Sarah Liu replied to &ldquo;Quick one&rdquo;</div>
            <div className="font-mono text-[10px] text-[#E85002] tracking-[0.1em] mt-0.5">▸ MEETING BOOKED · THURSDAY 3:00 PM EST · 30 MIN</div>
          </div>
          <button className="inline-flex items-center gap-2 border border-black font-[Archivo] font-bold text-[11px] uppercase tracking-[0.06em] px-3 py-2 leading-none bg-gradient-to-br from-black via-[#C10801] to-[#F16001] text-[#F9F9F9] shadow-[2px_2px_0_0_#000]">OPEN <ArrowIcon /></button>
        </div>
      </div>
    </div>
  );
}

// ─── Steps section ────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: '01', eyebrow: 'TELL US', h: 'Tell us about your business.',
    body: 'Complete a 90-second onboarding form. Our engine learns who you target, what copy resonates, and how to speak in your voice in every reply.',
    bullets: ['Ingests company URL, vertical, and target ICP', 'Builds a positioning brief in under 60 seconds', 'Extracts pain points, competitors, and buyer triggers'],
    panel: <Step1Panel />, alt: false,
  },
  {
    num: '02', eyebrow: 'WARM UP', h: 'Connect & warm up your inboxes.',
    body: 'Link your sending accounts and let our engine handle the technical layer — warming, DNS, sending reputation. New domains and inboxes start at $3.50 per account.',
    bullets: ['28-day automated ramp — no spam folder roulette', 'SPF, DKIM, DMARC validated on every connect', 'Live deliverability score with daily drift alerts'],
    panel: <Step2Panel />, alt: true,
  },
  {
    num: '03', eyebrow: 'BUILD LIST', h: 'Build your prospect list.',
    body: 'Filter our 325M-lead database to your exact ICP, then pull verified personal emails of decision-makers ready to hear from you. No more scraping, no more bounced sends.',
    bullets: ['325M+ contacts · 62M+ companies · triple-verified', 'Filter by role, tech stack, revenue, hiring signals', '98.2% email accuracy — bounce risk surfaced inline'],
    panel: <Step3Panel />, alt: false,
  },
  {
    num: '04', eyebrow: 'LAUNCH', h: 'Launch campaigns that get positive replies.',
    body: 'Our AI scrapes each prospect\'s website, LinkedIn, and funding history to write unique opening lines — not generic Mad Lib templates.',
    bullets: ['Per-prospect openers, not {{variables}} stitched together', 'A/B test subject lines, send windows, and persona angles', 'Auto-pause on bounce spikes or reputation drift'],
    panel: <Step4Panel />, alt: true,
  },
  {
    num: '05', eyebrow: 'CLOSE', h: 'Send, sort, and close.',
    body: 'Launch and let the engine send. Our AI auto-categorizes every reply — separating time-wasters from ready-to-buy leads so you only see the inbox that matters.',
    bullets: ['Replies auto-classified: INTERESTED · BOOKED · OOO · NOT NOW', 'One-tap calendar links for hot replies', 'CRM sync — booked calls land in HubSpot, Pipedrive, Attio'],
    panel: <Step5Panel />, alt: false,
  },
];

function Steps() {
  return (
    <section className="py-[120px] border-b-2 border-black">
      <div className="max-w-[1320px] mx-auto px-8">
        <div className="grid grid-cols-[1fr_1.2fr] gap-12 items-end mb-16 lg:grid-cols-1 lg:gap-8">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#646464] mb-3.5">THE FIVE-CLICK WORKFLOW</div>
            <h2 className="font-[Archivo] font-black text-[56px] leading-[1.02] tracking-[-0.02em] m-0 lg:text-[44px]">
              From zero to a<br />booked call in<br /><span className="text-[#E85002]">five clicks.</span>
            </h2>
          </div>
          <p className="font-[Chivo] text-[18px] leading-[1.55] text-[#646464] max-w-[60ch] m-0">
            Whether you&rsquo;re experimenting or ready to scale, ConvergeFlow lets you launch real outbound on your own — without hiring, writing, or manual grind.
          </p>
        </div>
        {STEPS.map(({ num, eyebrow, h, body, bullets, panel, alt }) => (
          <div key={num} className={`grid gap-20 items-center border-t-2 border-black pt-[72px] pb-[72px] lg:grid-cols-1 lg:gap-8 ${alt ? 'grid-cols-[1.15fr_0.85fr]' : 'grid-cols-[0.85fr_1.15fr]'}`}>
            <div className={alt ? 'lg:order-last' : ''}>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#646464] mb-1.5">
                {num}<span className="text-[#E85002]">.</span> &nbsp;{eyebrow}
              </div>
              <h3 className="font-[Archivo] font-black text-[48px] leading-[1.05] tracking-[-0.02em] mt-1.5 mb-[18px] lg:text-[36px]">{h}</h3>
              <p className="font-[Chivo] text-[17px] text-[#333333] max-w-[48ch] mb-6 leading-[1.6]">{body}</p>
              <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
                {bullets.map((b) => (
                  <li key={b} className="flex gap-3 items-start text-[14px]">
                    <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className={alt ? '' : ''}>{panel}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features() {
  return (
    <section className="bg-[#050505] text-[#F9F9F9] pb-0 pt-[120px] border-b-2 border-black">
      <div className="max-w-[1320px] mx-auto px-8">
        <div className="grid grid-cols-[1fr_1.2fr] gap-12 items-end mb-16 lg:grid-cols-1 lg:gap-8">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#E85002] mb-3.5">EVERY OUNCE OF OUTBOUND</div>
            <h2 className="font-[Archivo] font-black text-[56px] leading-[1.02] tracking-[-0.02em] text-[#F9F9F9] m-0 lg:text-[44px]">
              One platform.<br />Replaces your<br /><span className="text-[#E85002]">entire cold stack.</span>
            </h2>
          </div>
          <p className="font-[Chivo] text-[18px] leading-[1.55] text-[#A7A7A7] max-w-[60ch] m-0">
            Lead database. AI personalization. Sequencing. Deliverability. Inbox. All built native — no Zapier glue, no janky exports, no excuses.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-[#333] lg:grid-cols-1">
        {/* Feature 1 */}
        <div className="p-12 border-r border-b border-[#333] flex flex-col gap-6 bg-[#0a0a0a] min-h-[480px] lg:border-r-0">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#E85002]">LEAD DATABASE</div>
            <h3 className="font-[Archivo] font-black text-[32px] leading-[1.05] tracking-[-0.015em] text-[#F9F9F9] mt-2.5">325M verified contacts. Filter to the one.</h3>
            <p className="font-[Chivo] text-[15px] text-[#A7A7A7] leading-[1.55] max-w-[42ch] mt-3">Search triple-verified company and people data. Filter by job title, vertical, headcount, revenue, tech stack, hiring activity, and 50+ other signals.</p>
          </div>
          <div className="flex-1 flex items-center">
            <div className="bg-[#050505] border border-[#333] p-4 w-full">
              <div className="flex items-center gap-2 border border-[#333] p-[9px_12px] font-mono text-[11px] text-[#A7A7A7] bg-[#0a0a0a] mb-2.5">
                <span className="text-[#646464]">⌕</span>Search 325M+ leads…
              </div>
              <div className="flex gap-1.5 flex-wrap mb-3.5">
                {['CEO / FOUNDER', 'SAAS', 'USA', '10–500 EMP'].map((c) => (
                  <span key={c} className="font-[Chivo] text-[11px] uppercase tracking-[0.06em] font-medium px-2.5 py-1.5 bg-[#0c0c0c] text-[#F9F9F9] border border-[#333]">{c}</span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-px bg-[#333] border border-[#333]">
                {[['325M+','TOTAL LEADS'],['62M+','COMPANIES'],['98.2%','EMAIL ACCURACY'],['50+','DATA POINTS']].map(([v,l]) => (
                  <div key={l} className="bg-[#050505] p-3.5">
                    <div className="font-mono font-medium text-[24px] text-[#E85002] tracking-[-0.02em]">{v}</div>
                    <div className="font-mono text-[10px] text-[#A7A7A7] tracking-[0.12em] uppercase mt-1">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Feature 2 */}
        <div className="p-12 border-b border-[#333] flex flex-col gap-6 bg-[#0a0a0a] min-h-[480px]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#E85002]">AI PERSONALIZATION</div>
            <h3 className="font-[Archivo] font-black text-[32px] leading-[1.05] tracking-[-0.015em] text-[#F9F9F9] mt-2.5">Researches every prospect. Writes every line.</h3>
            <p className="font-[Chivo] text-[15px] text-[#A7A7A7] leading-[1.55] max-w-[42ch] mt-3">Our agent reads each prospect&rsquo;s website, LinkedIn, funding history, and tech stack — then drafts a unique opener that sounds like you wrote it.</p>
          </div>
          <div className="flex-1 flex items-center">
            <div className="bg-[#050505] border border-[#333] p-4 w-full">
              <div className="flex items-center gap-2 mb-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E85002" strokeWidth="2"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>
                <span className="font-mono text-[10px] text-[#E85002] uppercase tracking-[0.14em]">RESEARCH AGENT · ACTIVE</span>
              </div>
              {['Scraped prospect site','Analyzed LinkedIn','Found funding round'].map((s) => (
                <div key={s} className="flex items-center gap-2.5 py-[5px] font-mono text-[12px] text-[#F9F9F9] border-b border-[#1a1a1a] last:border-0">
                  <span className="w-3.5 h-3.5 bg-[#365E3D] border-[#365E3D] border flex-shrink-0 flex items-center justify-center text-white text-[10px]">✓</span>{s}
                </div>
              ))}
              <div className="flex items-center gap-2.5 py-[5px] font-mono text-[12px] text-[#E85002]">
                <span className="w-3.5 h-3.5 border-[#E85002] border flex-shrink-0" />Writing opener…
              </div>
              <div className="mt-3 border-t border-[#333] pt-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#A7A7A7]">GENERATED</div>
                <p className="font-[Chivo] text-[13px] leading-[1.5] text-[#D9C3AB] italic mt-1.5">&ldquo;Hi Sarah — congrats on TechFlow&rsquo;s Series B. Scaling enterprise sales with a lean team is no joke…&rdquo;</p>
              </div>
            </div>
          </div>
        </div>
        {/* Feature 3 */}
        <div className="p-12 border-r border-[#333] flex flex-col gap-6 bg-[#0a0a0a] min-h-[480px] lg:border-r-0">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#E85002]">SEQUENCES</div>
            <h3 className="font-[Archivo] font-black text-[32px] leading-[1.05] tracking-[-0.015em] text-[#F9F9F9] mt-2.5">Multi-step automation. A/B baked in.</h3>
            <p className="font-[Chivo] text-[15px] text-[#A7A7A7] leading-[1.55] max-w-[42ch] mt-3">Launch four-step sequences with follow-ups, smart scheduling, and live A/B variants. Land in the primary inbox — not spam, not promotions.</p>
          </div>
          <div className="flex-1 flex items-center">
            <div className="bg-[#050505] border border-[#333] p-4 w-full">
              <div className="font-[Archivo] font-bold text-[13px] text-[#F9F9F9] mb-1">SaaS Founders · Q2</div>
              <div className="font-mono text-[10px] text-[#A7A7A7] uppercase tracking-[0.1em] mb-3">3-STEP · 847 PROSPECTS</div>
              {[['D1','Quick question about {{company}}','green'],['D4','Following up, {{first_name}}','green'],['D9','{{company}} + CF — 15 min?','yellow']].map(([d,s,c]) => (
                <div key={d} className={`grid grid-cols-[40px_1fr_auto] gap-2.5 border border-[#333] p-[9px_10px] items-center mb-1.5 ${d === 'D9' ? 'bg-[#1a1a1a]' : ''}`}>
                  <span className="font-mono text-[10px] text-[#E85002]">{d}</span>
                  <span className="font-[Chivo] text-[12px] text-[#F9F9F9]">{s}</span>
                  <Badge variant={c as BadgeVariant} className="text-[9px]">{c === 'green' ? 'SENT' : 'QUEUED'}</Badge>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 mt-3.5 border-t border-[#333] pt-3.5">
                {[['1,247','SENT','#F9F9F9'],['68%','OPENS','#F9F9F9'],['12%','REPLIES','#E85002']].map(([v,l,c]) => (
                  <div key={l}>
                    <div className="font-mono text-[20px] tracking-[-0.02em]" style={{ color: c }}>{v}</div>
                    <div className="font-mono text-[9px] text-[#A7A7A7] uppercase tracking-[0.14em]">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Feature 4 */}
        <div className="p-12 border-[#333] flex flex-col gap-6 bg-[#0a0a0a] min-h-[480px]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#E85002]">DELIVERABILITY ENGINE</div>
            <h3 className="font-[Archivo] font-black text-[32px] leading-[1.05] tracking-[-0.015em] text-[#F9F9F9] mt-2.5">96%+ inbox placement. Reputation defended.</h3>
            <p className="font-[Chivo] text-[15px] text-[#A7A7A7] leading-[1.55] max-w-[42ch] mt-3">Automated warmup, DNS configuration, sending reputation management. Every check, every record, every domain — monitored and corrected for you.</p>
          </div>
          <div className="flex-1 flex items-center">
            <div className="bg-[#050505] border border-[#333] p-4 w-full">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-mono text-[10px] text-[#A7A7A7] uppercase tracking-[0.14em]">INBOX PLACEMENT</div>
                  <div className="font-mono font-medium text-[36px] text-[#E85002] tracking-[-0.03em] leading-none mt-1.5">96<span className="text-[#A7A7A7] text-[18px]">/100</span></div>
                </div>
                <Badge variant="green" className="text-[9px]">EXCELLENT</Badge>
              </div>
              <div className="h-1.5 bg-[#333] border border-[#333] mb-3.5">
                <div className="h-full w-[96%] bg-gradient-to-r from-black via-[#C10801] to-[#F16001]" />
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {['SPF','DKIM','DMARC'].map((s) => (
                  <Badge key={s} variant="green" className="justify-center text-[10px]">{s}</Badge>
                ))}
              </div>
              <div className="border-t border-[#333] pt-3 flex flex-col gap-1.5">
                {[['INBOX RATE','96.3%','#F9F9F9'],['SPAM RATE','0.8%','#365E3D'],['BOUNCE RATE','1.2%','#F9F9F9'],['REPUTATION','HIGH','#E85002']].map(([l,v,c]) => (
                  <div key={l} className="flex justify-between font-mono text-[11px]">
                    <span className="text-[#A7A7A7]">{l}</span>
                    <span style={{ color: c }} className="font-bold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Comparison ───────────────────────────────────────────────────────────────

function Comparison() {
  const neg = ['"No thanks, not interested."', '"Please remove me from your list."', '"Stop emailing me."', '"Wrong person."'];
  const pos = ['"This looks great — can we schedule a call?"', '"Send me more details about pricing."', '"Can you do a demo next Thursday?"', '"This is exactly what we need."', '"Let\'s set up a meeting this week."'];

  return (
    <section className="py-[120px] border-b-2 border-black bg-[#F9F9F9]">
      <div className="max-w-[1320px] mx-auto px-8">
        <div className="grid grid-cols-[1fr_1.2fr] gap-12 items-end mb-8 lg:grid-cols-1 lg:gap-8">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#646464] mb-3.5">REPLY-RATE THEATRE</div>
            <h2 className="font-[Archivo] font-black text-[56px] leading-[1.02] tracking-[-0.02em] m-0 lg:text-[44px]">
              Everyone brags<br />about reply rates.<br /><span className="text-[#E85002]">We don&rsquo;t.</span>
            </h2>
          </div>
          <p className="font-[Chivo] text-[18px] leading-[1.55] text-[#646464] max-w-[60ch] m-0">
            Other tools count &ldquo;no thanks&rdquo; and &ldquo;remove me&rdquo; as wins. We only measure what puts money in your pocket: positive replies from buyers ready to talk.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-1">
          {/* Theirs */}
          <div className="border-2 border-black bg-white shadow-[8px_8px_0_0_#A7A7A7]">
            <div className="px-7 py-6 border-b-2 border-black flex justify-between items-start gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#646464]">THEIR &ldquo;REPLY RATE&rdquo;</div>
                <h4 className="font-[Archivo] font-black text-[24px] tracking-[-0.01em] mt-1.5 mb-0">All replies counted equally.</h4>
              </div>
              <div className="font-mono font-medium text-[64px] tracking-[-0.04em] leading-none text-right">8.4<span className="text-[24px] text-[#646464]">%</span></div>
            </div>
            {[...neg.map((q) => ({ q, pos: false })), { q: '"Tell me more about this."', pos: true }].map(({ q, pos: p }) => (
              <div key={q} className={`px-7 py-3.5 border-b border-black flex items-center gap-3.5 font-[Chivo] text-[15px] last:border-0 ${!p ? 'line-through decoration-[#A63C32] decoration-2 text-[#646464]' : ''}`}>
                <span className={`w-[18px] h-[18px] border-[1.5px] rounded-full flex-shrink-0 flex items-center justify-center font-[Archivo] font-black text-[11px] ${!p ? 'border-[#A63C32] text-[#A63C32]' : 'border-black'}`}>{!p ? '×' : '✓'}</span>
                <span className="italic">{q}</span>
              </div>
            ))}
            <div className="px-7 py-5 flex items-center justify-between bg-[#D9C3AB] border-t-2 border-black">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em]">COUNTED AS REPLIES · 5 / 5</span>
              <span className="font-mono text-[11px] text-[#A63C32] font-bold tracking-[0.08em]">80% NEGATIVE</span>
            </div>
          </div>
          {/* Ours */}
          <div className="border-2 border-[#050505] bg-[#050505] text-[#F9F9F9] shadow-[8px_8px_0_0_#E85002]">
            <div className="px-7 py-6 border-b border-[#333] flex justify-between items-start gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#E85002]">CONVERGEFLOW · POSITIVE REPLY RATE</div>
                <h4 className="font-[Archivo] font-black text-[24px] tracking-[-0.01em] mt-1.5 mb-0 text-[#F9F9F9]">Only real buying intent counted.</h4>
              </div>
              <div className="font-mono font-medium text-[64px] tracking-[-0.04em] leading-none text-right text-[#E85002]">6.2<span className="text-[24px] text-[#A7A7A7]">%</span></div>
            </div>
            {pos.map((q) => (
              <div key={q} className="px-7 py-3.5 border-b border-[#1a1a1a] last:border-0 flex items-center gap-3.5 font-[Chivo] text-[15px] text-[#F9F9F9]">
                <span className="w-[18px] h-[18px] bg-[#E85002] border-[#E85002] border-[1.5px] rounded-full flex-shrink-0 flex items-center justify-center font-[Archivo] font-black text-[11px] text-[#050505]">✓</span>
                <span className="italic">{q}</span>
              </div>
            ))}
            <div className="px-7 py-5 flex items-center justify-between bg-[#E85002] border-t border-[#E85002]">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#050505]">REAL BUYING INTENT · 5 / 5</span>
              <span className="font-[Archivo] font-black text-[13px] tracking-[0.04em] text-[#050505]">EVERY REPLY = MEETING</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6 lg:grid-cols-1">
          <div>
            <h5 className="font-[Archivo] font-extrabold text-[18px] tracking-[-0.005em] mb-2">What others count as replies.</h5>
            <p className="font-[Chivo] text-[14px] text-[#333333] m-0">Inflated numbers designed to look impressive on a sales call — until you check how many actually want to buy. The result: bloated dashboards, empty calendars.</p>
          </div>
          <div>
            <h5 className="font-[Archivo] font-extrabold text-[18px] tracking-[-0.005em] mb-2">What ConvergeFlow measures.</h5>
            <p className="font-[Chivo] text-[14px] text-[#333333] m-0">Real responses from real prospects who want to hear more. The only metric that converts into a calendar invite. The only one we put on your dashboard.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Mobile App ───────────────────────────────────────────────────────────────

function MobileApp() {
  const phoneReplies = [
    { initials: 'SL', bg: 'bg-[#707653] text-white', name: 'Sarah Liu', co: 'STRETTO', preview: '"This looks great — can we schedule a call?"', badge: <Badge variant="green" className="text-[8px] py-[3px] px-1.5">INTERESTED</Badge>, link: true },
    { initials: 'MW', bg: 'bg-[#2E4C54] text-white', name: 'Marcus Wei', co: 'HELMSMAN', preview: '"Thursday at 3pm works perfectly."', badge: <Badge variant="orange" className="text-[8px] py-[3px] px-1.5">BOOKED</Badge>, link: false },
    { initials: 'AR', bg: 'bg-[#513C5E] text-white', name: 'Alex Rivera', co: 'NOVATECH', preview: '"Send me pricing details please."', badge: <Badge variant="green" className="text-[8px] py-[3px] px-1.5">INTERESTED</Badge>, link: true },
  ];

  return (
    <section className="py-[120px] border-b-2 border-black bg-[#050505] text-[#F9F9F9]">
      <div className="max-w-[1320px] mx-auto px-8 grid grid-cols-[1fr_460px] gap-20 items-center lg:grid-cols-1 lg:gap-12">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#E85002] mb-3.5">MOBILE APP</div>
          <h2 className="font-[Archivo] font-black text-[56px] leading-[1.02] tracking-[-0.02em] text-[#F9F9F9] mt-3.5 mb-6 lg:text-[44px]">Close deals from<br />your pocket.</h2>
          <p className="font-[Chivo] text-[18px] leading-[1.55] text-[#A7A7A7] max-w-[60ch] mb-8">
            Get the ConvergeFlow mobile app and never miss a hot lead. Instant push notifications the moment a positive reply lands.
          </p>
          <ul className="list-none p-0 m-0 flex flex-col gap-3.5 mb-8">
            {['Instant push notifications on positive replies', 'AI-suggested replies you can send in one tap', 'Book meetings directly from your phone', 'iOS & Android — biometric secured'].map((item) => (
              <li key={item} className="flex gap-3.5 items-start text-[16px] text-[#F9F9F9]">
                <span className="w-[22px] h-[22px] border-[1.5px] border-[#E85002] bg-[#E85002] text-[#050505] flex-shrink-0 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"><path d="M20 6L9 17l-5-5"/></svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="flex gap-3.5 items-center flex-wrap">
            <button className="inline-flex items-center gap-2 border border-[#F9F9F9] font-[Archivo] font-bold text-[13px] uppercase tracking-[0.06em] px-[18px] py-3 bg-[#F9F9F9] text-[#050505] shadow-[4px_4px_0_0_#E85002]">DOWNLOAD FOR iOS</button>
            <button className="inline-flex items-center gap-2 border border-[#050505] font-[Archivo] font-bold text-[13px] uppercase tracking-[0.06em] px-[18px] py-3 bg-[#050505] text-[#F9F9F9] shadow-[4px_4px_0_0_#E85002]">DOWNLOAD FOR ANDROID</button>
          </div>
        </div>
        {/* Phone */}
        <div className="w-[340px] mx-auto bg-[#050505] border-2 border-[#1a1a1a] rounded-[36px] p-2.5 shadow-[8px_8px_0_0_#E85002] lg:mx-auto">
          <div className="bg-[#F9F9F9] rounded-[28px] overflow-hidden">
            <div className="px-6 pt-3.5 pb-1.5 flex justify-between font-mono font-medium text-[13px] text-[#050505] items-center">
              <span>9:41</span>
              <span className="flex gap-[5px] items-center text-[11px]">
                <svg width="14" height="10" viewBox="0 0 14 10" fill="#050505"><rect x="0" y="6" width="2" height="4"/><rect x="3" y="4" width="2" height="6"/><rect x="6" y="2" width="2" height="8"/><rect x="9" y="0" width="2" height="10"/></svg>
                <span className="font-mono">5G</span>
                <svg width="22" height="10" viewBox="0 0 22 10" fill="none" stroke="#050505" strokeWidth="1"><rect x="0.5" y="0.5" width="18" height="9"/><rect x="2" y="2" width="15" height="6" fill="#050505"/><rect x="19.5" y="3" width="2" height="4" fill="#050505"/></svg>
              </span>
            </div>
            <div className="px-4 pb-[18px]">
              <div className="flex items-center gap-2 px-1 pb-3.5 pt-2 border-b border-black">
                <div className="flex items-center gap-1.5 font-[Archivo] italic font-black text-[13px] tracking-[-0.03em]">
                  <Image src="/cf-logomark.png" alt="" width={14} height={14} className="h-[14px] w-auto" />
                  <span>CONVERGEFLOW</span>
                </div>
                <span className="ml-auto bg-[#E85002] text-white font-[Archivo] font-black text-[12px] px-[9px] py-[3px] border border-[#050505]">3</span>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#646464] mt-3.5 mb-1.5 px-1">NEW REPLIES · 3 NEW</div>
              {phoneReplies.map((r) => (
                <div key={r.name} className="grid grid-cols-[36px_1fr_auto] gap-2.5 px-1 py-3 border-b border-black items-center last:border-0">
                  <div className={`w-[34px] h-[34px] ${r.bg} rounded-full border border-[#050505] flex-shrink-0 flex items-center justify-center font-[Archivo] font-black text-[12px]`}>{r.initials}</div>
                  <div>
                    <div className="font-[Archivo] font-bold text-[13px] text-[#050505]">{r.name}</div>
                    <div className="font-mono text-[9px] text-[#646464] uppercase tracking-[0.08em]">{r.co}</div>
                    <div className="font-[Chivo] text-[12px] text-[#333333] mt-0.5 leading-[1.35]">{r.preview}</div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {r.badge}
                    {r.link && <a href="#" className="font-mono text-[9px] text-[#E85002] underline">REPLY →</a>}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-1.5 pt-3.5 pb-1">
                {([['2','INTERESTED',true],['1','BOOKED',true],['3','TOTAL',false]] as [string,string,boolean][]).map(([v,l,acc]) => (
                  <div key={l} className="border border-black p-2.5 text-center">
                    <div className={`font-mono font-medium text-[18px] tracking-[-0.02em] ${acc ? 'text-[#E85002]' : ''}`}>{v}</div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#646464] mt-0.5">{l}</div>
                  </div>
                ))}
              </div>
              <div className="flex border-t border-black mt-2">
                {['INBOX','CAMPAIGNS','PROFILE'].map((t, i) => (
                  <div key={t} className={`flex-1 py-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] ${i === 0 ? 'text-[#050505] font-bold bg-[#D9C3AB]' : 'text-[#646464]'}`}>{t}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonial ──────────────────────────────────────────────────────────────

function Testimonial() {
  return (
    <section className="py-[120px] border-b-2 border-black bg-[#D9C3AB]">
      <div className="max-w-[1320px] mx-auto px-8">
        <div className="grid grid-cols-[1fr_1.2fr] gap-12 items-end mb-12 lg:grid-cols-1 lg:gap-8">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#646464] mb-3.5">CUSTOMER TESTIMONIAL</div>
            <h2 className="font-[Archivo] font-black text-[56px] leading-[1.02] tracking-[-0.02em] m-0 lg:text-[44px]">
              Founders &amp;<br />agencies, on the<br />record.
            </h2>
          </div>
          <p className="font-[Chivo] text-[18px] leading-[1.55] text-[#646464] max-w-[60ch] m-0">
            Join the growing number of B2B operators using ConvergeFlow for measurable outbound results — not vanity metrics.
          </p>
        </div>
        <div className="grid grid-cols-[1.6fr_1fr] gap-16 items-center lg:grid-cols-1 lg:gap-8">
          <div>
            <blockquote className="font-[Archivo] font-extrabold text-[42px] leading-[1.15] tracking-[-0.015em] text-[#050505] m-0 lg:text-[32px]">
              <span className="text-[#E85002]">&ldquo;</span>I tested ten different cold-email platforms. <span className="text-[#E85002]">ConvergeFlow is the only one</span> that put real meetings on my calendar in week one.<span className="text-[#E85002]">&rdquo;</span>
            </blockquote>
            <div className="flex items-center gap-4 mt-8 border-t border-black pt-5">
              <div className="w-14 h-14 bg-[#707653] border border-black rounded-full text-white flex items-center justify-center font-[Archivo] font-black text-lg">TM</div>
              <div>
                <div className="font-[Archivo] font-bold text-[18px]">Tomas Morkunas</div>
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#646464] mt-1">CO-FOUNDER · PREMIUM INBOXES</div>
              </div>
              <div className="ml-auto flex gap-0.5">
                {[1,2,3,4,5].map((i) => <StarIcon key={i} />)}
              </div>
            </div>
          </div>
          <div className="border-2 border-black bg-[#F9F9F9] shadow-[4px_4px_0_0_#050505] p-9 grid grid-cols-1 gap-6">
            {[
              [{ l: 'PLATFORMS TESTED', v: '10+', accent: false }, { l: 'CONVERGEFLOW RANK', v: '#1', accent: true }],
              [{ l: 'CALLS BOOKED · 30 DAYS', v: '38', accent: false }, { l: 'REPLY → MEETING', v: '42%', accent: true }],
            ].map((row, ri) => (
              <div key={ri}>
                <div className="flex justify-between items-baseline">
                  {row.map(({ l, v, accent }) => (
                    <div key={l} className={ri === 1 && l.includes('MEETING') ? 'text-right' : ''}>
                      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#646464]">{l}</div>
                      <div className={`font-mono font-medium text-[56px] tracking-[-0.04em] leading-none mt-1.5 ${accent ? 'text-[#E85002]' : ''}`}>{v}</div>
                    </div>
                  ))}
                </div>
                {ri === 0 && <hr className="border-t border-black mt-6" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="py-[120px] border-b-2 border-black relative overflow-hidden bg-gradient-to-br from-black via-[#C10801] to-[#F16001] text-[#F9F9F9]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,0,0,0.4),transparent_60%)] pointer-events-none" />
      <div className="max-w-[1320px] mx-auto px-8 relative">
        <div className="grid grid-cols-[1.2fr_1fr] gap-20 items-center lg:grid-cols-1 lg:gap-12">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#D9C3AB] mb-[18px]">READY · SET · LAUNCH</div>
            <h2 className="font-[Archivo] font-black text-[76px] leading-[0.98] tracking-[-0.025em] text-white mt-[18px] mb-6 lg:text-[56px]">
              Get started.<br />Book more<br />meetings.
            </h2>
            <p className="font-[Chivo] text-[18px] leading-[1.55] text-[rgba(249,249,249,0.85)] max-w-[46ch] mb-9">
              Unlock the potential of your outbound with an engine built to send, protect, and close. Set up in minutes. First meeting in week one.
            </p>
            <div className="flex gap-4 items-center flex-wrap">
              <Link href="/onboarding/signup" className="inline-flex items-center gap-2 border border-[#050505] font-[Archivo] font-bold text-[13px] uppercase tracking-[0.06em] px-[18px] py-3 leading-none bg-[#F9F9F9] text-[#050505] shadow-[4px_4px_0_0_#050505] hover:shadow-[2px_2px_0_0_#050505] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                Start for free <ArrowIcon />
              </Link>
              <button className="inline-flex items-center gap-2 border border-[#050505] font-[Archivo] font-bold text-[13px] uppercase tracking-[0.06em] px-[18px] py-3 leading-none bg-[#050505] text-[#F9F9F9] shadow-[4px_4px_0_0_#050505] hover:shadow-[2px_2px_0_0_#050505] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                Book a demo
              </button>
            </div>
          </div>
          <div className="border-l border-[rgba(249,249,249,0.3)] pl-8 flex flex-col gap-[18px]">
            {[
              { k: 'SETUP', v: '5 clicks. 15 minutes.' },
              { k: 'CARD', v: 'No credit card required.' },
              { k: 'TRIAL', v: '14 days. Full feature access.' },
              { k: 'SUPPORT', v: 'Real humans. < 4-hour reply.' },
              { k: 'REFUND', v: '30-day, no questions asked.' },
            ].map(({ k, v }) => (
              <div key={k} className="flex gap-3.5 items-start">
                <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#D9C3AB] flex-shrink-0 w-16 pt-0.5">{k}</span>
                <span className="font-[Archivo] font-bold text-[18px] leading-[1.3] text-[#F9F9F9]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-[#050505] text-[#F9F9F9] pt-16 pb-7">
      <div className="max-w-[1320px] mx-auto px-8">
        <div className="grid grid-cols-[1.4fr_repeat(4,1fr)] gap-12 pb-12 border-b border-[#333] lg:grid-cols-2 lg:gap-8">
          <div>
            <Link href="/" className="flex items-center gap-3 font-[Archivo] font-black italic text-[24px] tracking-[-0.04em] text-[#F9F9F9] mb-3.5">
              <Image src="/cf-logomark.png" alt="" width={32} height={32} className="h-8 w-auto" />
              <span>CONVERGEFLOW</span>
            </Link>
            <p className="font-[Chivo] text-[14px] text-[#A7A7A7] max-w-[32ch] mb-6 leading-[1.55]">The cold-email engine for non-technical founders and agencies. 5 clicks to a booked call.</p>
            <div className="flex">
              <input type="email" placeholder="your@email.com" className="flex-1 border border-[#F9F9F9] bg-transparent text-[#F9F9F9] px-3.5 py-3 outline-none font-[Chivo] text-[13px] placeholder:text-[#646464]" />
              <button className="border border-[#F9F9F9] border-l-0 bg-[#E85002] text-white px-[18px] py-3 font-[Archivo] font-bold text-[11px] uppercase tracking-[0.1em]">Subscribe</button>
            </div>
            <div className="font-mono text-[10px] text-[#646464] tracking-[0.1em] mt-2.5 uppercase">Weekly updates. No spam.</div>
          </div>
          {[
            { title: 'Product', links: ['Overview', 'AI Personalization', 'Lead Database', 'Sequences', 'Deliverability', 'Smart Inbox', 'Mobile App', 'Pricing'] },
            { title: 'Solutions', links: ['Whitelabel NEW', 'B2B Companies', 'Agencies', 'Sales Teams', 'Consultants', 'SaaS Companies', 'Enterprise'] },
            { title: 'Resources', links: ['Blog', 'Case Studies', 'Free Tools', 'ROI Calculator', 'Affiliate Program', 'Contact', 'Book a Demo'] },
            { title: 'Legal', links: ['Terms of Service', 'Privacy Policy', 'DPA', 'Security'] },
          ].map(({ title, links }) => (
            <div key={title}>
              <h6 className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#E85002] mb-4">{title}</h6>
              <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
                {links.map((l) => {
                  const isNew = l.endsWith(' NEW');
                  const label = isNew ? l.replace(' NEW', '') : l;
                  return (
                    <li key={l}>
                      <Link href="#" className="font-[Chivo] text-[13px] text-[#A7A7A7] hover:text-[#F9F9F9] transition-colors">
                        {label}{isNew && <span className="inline-block bg-[#E85002] text-white text-[9px] px-1.5 py-[2px] ml-1.5 border border-[#050505] font-mono uppercase tracking-[0.1em]">NEW</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-7 font-mono text-[11px] text-[#646464] uppercase tracking-[0.08em]">
          <span>© 2026 ConvergeFlow · all rights reserved</span>
          <span className="flex gap-6 items-center">
            <span>Designed by Varritech</span>
            <span className="flex items-center gap-2 text-[#365E3D]">
              <span className="w-1.5 h-1.5 bg-[#365E3D] rounded-full animate-pulse" />
              All systems operational
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62.5..125,100..900;1,62.5..125,100..900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .animate-\\[marquee_32s_linear_infinite\\] { animation: marquee 32s linear infinite; }
      `}</style>
      <Nav />
      <Hero />
      <LogoRail />
      <Steps />
      <Features />
      <Comparison />
      <MobileApp />
      <Testimonial />
      <FinalCTA />
      <Footer />
    </>
  );
}
