-- Matayia's Welfare: loan dates migration
-- Run this once in Supabase SQL Editor before deploying the updated frontend.
-- Existing loans are preserved; the new fields are nullable so old records continue to work.

alter table public.loans
  add column if not exists date_borrowed date default current_date,
  add column if not exists due_date date,
  add column if not exists actual_return_date date;

-- Backfill the borrowing date for old records where it is missing.
update public.loans
set date_borrowed = coalesce(date_borrowed, current_date)
where date_borrowed is null;

-- Optional: give old outstanding loans a due date 30 days after their borrowing date.
-- Remove the following UPDATE if you prefer to enter due dates manually for old loans.
update public.loans
set due_date = date_borrowed + 30
where due_date is null and status <> 'repaid';
