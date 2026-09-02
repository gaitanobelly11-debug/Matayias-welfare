# Matayia's Welfare — Web App

A member management app for Matayia's Welfare group: members, events, attendance,
contributions (monthly share, merry-go-round, benevolent fund, table banking),
announcements, and meeting minutes.

The database is already live on Supabase (project: `matayias-welfare`). This folder
is the frontend — deploy it to Vercel and connect it to your domain.

## 1. Deploy to Vercel

1. Create a free account at https://vercel.com if you don't have one (you can sign
   in with GitHub, GitLab, or email).
2. Push this folder to a GitHub repository (or use Vercel's CLI/drag-and-drop
   deploy if you'd rather not use GitHub — see "Alternative: deploy without GitHub"
   below).
3. In Vercel, click **Add New → Project**, import the repository, and Vercel will
   auto-detect it as a Vite app. Leave the build settings as default
   (`npm run build`, output directory `dist`).
4. Before clicking Deploy, add two **Environment Variables** (Vercel will prompt
   you, or go to Project Settings → Environment Variables):
   - `VITE_SUPABASE_URL` = `https://bhjpyxmlzojdoziopmor.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (the long key in `.env.example` — copy it exactly)
5. Click **Deploy**. Vercel gives you a working link like
   `matayias-welfare.vercel.app` within a minute or two — test it there first.

### Alternative: deploy without GitHub
Install the Vercel CLI (`npm i -g vercel`) on a computer with this folder, run
`vercel` inside it, follow the prompts, and add the same two environment
variables when asked (or afterwards in the Vercel dashboard).

## 2. Register the domain

Register `matayiaswelfare.co.ke` through any KENIC-accredited registrar (e.g.
Truehost, NovaHost, Webregister). You'll need a national ID/passport scan and a
proof of address. Cost is typically around Ksh 1,000–1,500 for the first year,
paid via M-Pesa or card, and the domain is usually active within minutes.

## 3. Point the domain at Vercel

Once both the domain and the Vercel deployment exist:
1. In Vercel, go to your project → **Settings → Domains** → add
   `matayiaswelfare.co.ke`.
2. Vercel will show you DNS records to add (usually an `A` record and a `CNAME`
   for `www`).
3. Log into your domain registrar's dashboard, find DNS management, and add
   those exact records.
4. DNS changes can take anywhere from a few minutes to a few hours to take
   effect. Once it does, `matayiaswelfare.co.ke` will load your app directly,
   with a free SSL certificate (https) that Vercel manages automatically.

## First login

Default admin account: **admin** / **admin123** — change it immediately after
your first login using the "Password" button in the app header.

## Notes on data & security

- All group data (members, contributions, events, etc.) lives in Supabase and is
  shared — anyone logged into the app sees the same live data, from any device.
- Passwords are stored as plain text in the database (matching how the earlier
  prototype worked) — don't reuse a sensitive personal password for this app.
- The database currently allows full read/write access to anyone with the
  `VITE_SUPABASE_ANON_KEY` (which is public in the deployed app's code — this is
  normal for anon keys, but it means the login inside the app is the only gate).
  This is reasonable for a small trusted group; if the group grows or handles
  more sensitive data later, consider tightening the database policies (ask
  Claude to help with this — it's a quick change).

## Local development (optional)

If you want to preview or tweak the app on your own computer before deploying:
```
npm install
cp .env.example .env
npm run dev
```

## Loan safety improvements in this version

- Loan amounts must be greater than zero and cannot exceed the current table-banking balance.
- Interest rate must be between 0% and 100%.
- The loan balance is checked again against fresh Supabase data immediately before a new loan is inserted.
- Repayments must be greater than zero and cannot exceed the remaining amount due.
- Loan repayment updates are rolled back on a best-effort basis if the loan update fails.
- Deleting a loan first removes its repayment history, then removes the loan record.
- Loan statistics show available funds, outstanding principal, amount still due, and repayments received.
- Member/account data is loaded only after a successful login instead of loading all welfare data on the login screen.

### Important security note

This project still uses the prototype's custom `accounts` table and client-side password checking. For a production system containing financial records, Supabase Auth plus Row Level Security should eventually replace this prototype authentication model. The improvements above reduce accidental exposure and input errors, but they do not replace database-level security policies.

## Phone-only Android build

A GitHub Actions workflow is included at `.github/workflows/build-android.yml`. It builds the Capacitor Android project in GitHub's cloud and uploads the debug APK as an artifact. See `PHONE_BUILD.md` for phone-only instructions.
