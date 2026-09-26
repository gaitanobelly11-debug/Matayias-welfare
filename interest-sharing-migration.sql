-- Matayia's Welfare: proportional interest sharing
-- Run this ONCE in Supabase SQL Editor before deploying the updated frontend.
-- The app uses Table Banking contributions within each round's dates as the
-- contribution base, then snapshots each member's percentage and interest share.

create table if not exists public.interest_rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  total_interest numeric(12,2) not null default 0,
  retained_amount numeric(12,2) not null default 0,
  distributable_interest numeric(12,2) not null default 0,
  total_contributions numeric(12,2) not null default 0,
  status text not null default 'finalized',
  finalized_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.interest_distributions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.interest_rounds(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  contribution_total numeric(12,2) not null default 0,
  contribution_percentage numeric(12,6) not null default 0,
  interest_share numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  unique(round_id, member_id)
);

create index if not exists interest_distributions_round_idx
  on public.interest_distributions(round_id);

create index if not exists interest_distributions_member_idx
  on public.interest_distributions(member_id);

-- This project currently uses its existing permissive prototype policies.
-- If RLS is enabled on these tables in your project, allow the app's current
-- anon client to read/write them in the same way as the other welfare tables.
