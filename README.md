# ProTrack

Production-management web app for a small manufacturing business in Uzbekistan.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS, single-typeface (Geist) minimal design
- React Router · TanStack Query · Recharts
- Supabase (Postgres + Auth + Realtime + Storage + Edge Functions)
- Vitest for unit tests; GitHub Actions for CI

Path alias: `@/` → `src/`.

## Quick start

```bash
git clone https://github.com/rasuljonLuxodd/ProTruck.git
cd ProTruck
cp .env.example .env.local        # fill in VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

App opens at <http://localhost:5173>.

```bash
npm run build       # production build
npm run preview     # preview the built bundle
npm test            # run vitest suite
```

## What's inside

### Pages
- **Dashboard** — totals, last-7-days chart, TOP 3 products, recent activity feed, low-stock alert
- **Ishlab chiqarish** — products with stock badges, daily production entry, CSV import, image uploads, edit/delete
- **Sotuvlar** — cart-based sale flow, payment chips (naqd / karta / qarz / aralash), customer autocomplete, refund + receipt print, CSV export
- **Nasiyalar** — partial / full payment, days passed, CSV export
- **Mijozlar** — per-customer ledger (sales + debts + payments) with credit limits
- **Xarajatlar** — filters, edit / delete, CSV export, recurring rules section, supplier picker
- **Ishchilar** — bio cards, work-day attendance toggle (synced to monthly count), bonus / penalty / advance, salary payment with snapshotted payslip print
- **Taqvim** — 12-month grid with profit/loss colour
- **Hisobotlar** — broadsheet monthly report with PDF print, 6-month profit trend
- **Sozlamalar** — Profile (name + email + password + 2FA enrollment), Preferences (language + theme), Users (super_admin only)

### Auth & roles
- Supabase Auth — email/password sign-in, persistent sessions
- **Super admin** sees everything, manages users (via `create-user` edge function), can set credit limits
- **Admin** sees goods/money pages only — workers/calendar/reports are RLS-protected at the DB level, not just hidden
- First user to sign up becomes super_admin (database trigger)
- 2FA (TOTP) — enroll in Settings, challenge enforced at sign-in
- Forgot password flow → emailed reset link → `/reset-password`
- Soft-delete users (`deleted_at` column) so deleted accounts can't loop on sign-in
- Session-expiry banner with one-click refresh

### Realtime & integrity
- Postgres realtime publication on every business table; client invalidates React Query caches on any change
- Atomic `sell_products` RPC for sales — validates stock, decrements, inserts sale, optional debt, action log in one transaction. Rejects overselling
- Atomic `refund_sale` RPC — restores stock + drops linked debt + logs
- Action logs attributed to `auth.uid()`
- `run_recurring_expenses` RPC — idempotent monthly auto-insert (runs once per session at most)
- Customer credit limits — soft warning at sale time

### i18n & theme
- **Uzbek (default)** · English · Russian. Saved in localStorage.
- **Light (default)** / dark themes. Saved in localStorage.
- Locale-aware date display via `useFormatDate` hook.

### UX
- Skeleton loaders during initial fetch
- Optimistic updates on add-mutations (products, sales, expenses, debts, workers)
- Empty states with onboarding CTAs
- Cmd/Ctrl+K command palette (jump-to-page + actions)
- Collapsible desktop sidebar
- In-app notifications (low stock, overdue debts, big sales today)
- Receipt + payslip print views
- CSV export on Sales / Expenses / Debts, CSV import for Products

## Architecture — `Repository` swap-ready

Every data call goes through the `Repository` interface in
[`src/data/repository.ts`](src/data/repository.ts). Two implementations live
side by side:

- [`LocalStorageRepository`](src/data/localStorageRepository.ts) — for offline / demo runs (`VITE_BACKEND=local`)
- [`SupabaseRepository`](src/data/supabaseRepository.ts) — the real backend (`VITE_BACKEND=supabase`, default)

UI components use the React Query hooks under `src/hooks/`, which only ever
talk to the repository — never directly to Supabase. So you can swap storage
without touching pages.

## Folder layout

```
src/
  auth/                AuthProvider, ProtectedRoute
  components/
    layout/            Layout, Sidebar, PageHeader
    settings/          TwoFactorSection
    ui/                Modal, Toast, StatCard, Badge, Skeleton, EmptyState,
                       CommandPalette, PrintableSlip, NotificationBell,
                       SessionBanner, ConfirmDialog, Field
  data/                repository.ts, localStorageRepository.ts,
                       supabaseRepository.ts, supabaseClient.ts,
                       RepositoryProvider.tsx, useRealtimeSync.ts
  hooks/               useProducts, useSales, useDebts, useExpenses,
                       useWorkers, useUsers, useActionLogs,
                       useProductionLogs, useRecurringExpenses,
                       useNotifications, useCreditLimits, useSuppliers
  i18n/                LanguageProvider, translations
  theme/               ThemeProvider
  lib/                 format, calc, csv, utils, useFormatters
  pages/               Login, ForgotPassword, ResetPassword, Dashboard,
                       Production, Sales, Debts, Expenses, Customers,
                       Workers, Calendar, Reports, Settings
  types.ts
```

## Deploy

### Vercel (recommended)

1. Push the repo to GitHub.
2. Import the project on [vercel.com/new](https://vercel.com/new) and pick the Vite preset.
3. In **Environment Variables**, set:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — the publishable key
   - `VITE_BACKEND=supabase`
4. Deploy. SPA rewrites are handled by `vercel.json`.

### Manual / any static host

```bash
npm run build
# upload dist/ to your host; configure it to rewrite all routes to /index.html
```

## Supabase setup

If you're starting from a fresh Supabase project, the schema and policies are
in `supabase_migrations.schema_migrations` (applied via the MCP tool during
development). The relevant migrations in order:

1. `init_protrack_schema` — all 10 tables + RLS + trigger
2. `add_email_to_profiles`
3. `harden_trigger_functions`
4. `is_super_admin_invoker`
5. `add_user_id_to_action_logs`
6. `sell_products_rpc`
7. `profiles_soft_delete`
8. `products_min_stock`
9. `recurring_expenses`
10. `worker_attendance`
11. `refund_sale_rpc`
12. `customer_credit_limits`
13. `products_image_url_and_bucket`
14. `currency_and_vat`
15. `suppliers`

Edge function: `create-user` (uses service role to provision new users
without logging out the current admin).

### Recommended Supabase config changes

- **Authentication → Providers → Email → Confirm email**: toggle **off** for an
  internal admin tool. (When on, super-admin-created users must click an email
  link before signing in — fine for production with a proper SMTP provider.)
- Set up SMTP under **Authentication → Email Templates** if you keep email
  confirmation or forgot-password flows on.

## CI

GitHub Actions runs on every push/PR: lint (tsc -b) → tests (vitest) → build.
See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## License

Private — internal tool.
