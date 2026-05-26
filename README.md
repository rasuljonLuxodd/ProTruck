# ProTrack

Production-management web app for a small manufacturing business in Uzbekistan.
Frontend-only build — data lives in `localStorage` via a repository layer that
can later be swapped for Supabase without touching any UI component.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS (with CSS variables for theming)
- React Router
- TanStack Query
- Recharts
- Path alias: `@/` → `src/`

## Features

- 8 pages: Dashboard, Ishlab chiqarish, Sotuvlar, Nasiyalar, Xarajatlar, Ishchilar, Taqvim, Hisobotlar
- 3 languages: **Uzbek (default)**, English, Russian — switched from the sidebar
- 2 themes: **Light (default)** and Dark — toggled from the sidebar
- Cross-page connections (sale → stock decrement → auto-debt; worker payment → auto-expense; etc.)
- Action log feeding Dashboard's recent activity
- Cart-based sale flow with mixed payments
- Worker payouts with snapshot history

## Run

```bash
npm install
npm run dev
```

App opens at <http://localhost:5173>.

```bash
npm run build       # production build
npm run preview     # preview the built bundle
```

## Architecture — Supabase swap

All data flows through the `Repository` interface in
[`src/data/repository.ts`](src/data/repository.ts). The current
implementation is [`LocalStorageRepository`](src/data/localStorageRepository.ts),
wired in [`src/data/RepositoryProvider.tsx`](src/data/RepositoryProvider.tsx).

**To swap to Supabase**, implement `SupabaseRepository` against the same
interface and change exactly one line in `RepositoryProvider.tsx`:

```ts
const repo = useMemo<Repository>(
  () => new SupabaseRepository(supabaseClient),
  [],
);
```

No component, page, or hook references `localStorage` directly — they all go
through the React Query hooks under `src/hooks/`, which in turn call the
repository. Every repository method already returns a `Promise`, so the
signatures are Supabase-ready.

## Folder layout

```
src/
  data/        repository.ts, localStorageRepository.ts, RepositoryProvider.tsx
  hooks/       useProducts, useSales, useDebts, useExpenses, useWorkers, ...
  i18n/        LanguageProvider.tsx, translations.ts (uz/en/ru)
  theme/       ThemeProvider.tsx
  lib/         format.ts, calc.ts, utils.ts
  components/  layout/ (Sidebar, PageHeader, Layout), ui/ (Modal, Toast, ...)
  pages/       Dashboard, Production, Sales, Debts, Expenses, Workers, Calendar, Reports
  types.ts
  App.tsx, main.tsx
```
