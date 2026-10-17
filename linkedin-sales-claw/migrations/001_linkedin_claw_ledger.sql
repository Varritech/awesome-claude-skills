-- LinkedIn sales claw ledger: everyone the claw invited, opened or spoke
-- with, and whose thread it is (claw or Cristiano). Source of truth for the
-- claw; written after every confirmed browser action.
create table if not exists public.linkedin_claw_leads (
  slug text primary key,
  name text,
  headline text,
  owner text check (owner in ('claw', 'cristiano')),
  status text,
  invited_at timestamptz,
  accepted_at timestamptz,
  claw_messaged_at timestamptz,
  taken_over_at timestamptz,
  handoff boolean not null default false,
  booked_at timestamptz,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.linkedin_claw_messages (
  id bigserial primary key,
  slug text not null references public.linkedin_claw_leads(slug) on delete cascade,
  seq int not null,
  at timestamptz not null,
  from_side text not null check (from_side in ('us', 'them')),
  by_claw boolean not null,
  kind text,
  text text not null,
  created_at timestamptz not null default now(),
  unique (slug, seq)
);

create index if not exists linkedin_claw_leads_owner on public.linkedin_claw_leads (owner);
create index if not exists linkedin_claw_messages_at on public.linkedin_claw_messages (at desc);

alter table public.linkedin_claw_leads enable row level security;
alter table public.linkedin_claw_messages enable row level security;
