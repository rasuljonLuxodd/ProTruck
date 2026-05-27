import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { useAuth } from '@/auth/AuthProvider';
import { useRealtimeSync } from '@/data/useRealtimeSync';
import { supabase } from '@/data/supabaseClient';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Route-level code splitting.
 *
 * Each page is its own chunk so the first paint only ships Dashboard
 * (~250 KB gzipped instead of the previous 439 KB monolith). Recharts,
 * jsPDF, and Workbox are particularly heavy — splitting them off means
 * a user who never visits Reports never downloads Recharts.
 *
 * Login is NOT lazy because it's the first thing an unauthenticated
 * visitor sees — wrapping it in <Suspense> would flash a skeleton
 * before the form, which is worse than the modest size savings.
 */
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const Dashboard  = lazy(() => import('@/pages/Dashboard'));
const Production = lazy(() => import('@/pages/Production'));
const Sales      = lazy(() => import('@/pages/Sales'));
const Debts      = lazy(() => import('@/pages/Debts'));
const Expenses   = lazy(() => import('@/pages/Expenses'));
const Workers    = lazy(() => import('@/pages/Workers'));
const Calendar   = lazy(() => import('@/pages/Calendar'));
const Reports    = lazy(() => import('@/pages/Reports'));
const Customers  = lazy(() => import('@/pages/Customers'));
const Settings   = lazy(() => import('@/pages/Settings'));

/**
 * Shimmer placeholder while a route's JS chunk loads. Roughly mimics
 * the shape of a page so the layout doesn't jump when the real
 * content arrives.
 */
function RouteFallback() {
  return (
    <div className="p-6 md:p-8 space-y-4">
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export default function App() {
  const { currentUser } = useAuth();
  // Live-sync only when signed in & using the Supabase backend.
  const useSupabase = (import.meta.env.VITE_BACKEND ?? 'supabase').toLowerCase() !== 'local';
  useRealtimeSync(!!currentUser && useSupabase);

  // Idempotent: fire the recurring-expense runner once per signed-in session
  // so monthly entries (rent, electricity, etc.) materialize on time.
  useEffect(() => {
    if (!currentUser || !useSupabase) return;
    void supabase.rpc('run_recurring_expenses');
  }, [currentUser, useSupabase]);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* admin + super_admin */}
        <Route path="/"           element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/production" element={<ProtectedRoute><Production /></ProtectedRoute>} />
        <Route path="/sales"      element={<ProtectedRoute><Sales /></ProtectedRoute>} />
        <Route path="/debts"      element={<ProtectedRoute><Debts /></ProtectedRoute>} />
        <Route path="/expenses"   element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
        <Route path="/customers"       element={<ProtectedRoute><Customers /></ProtectedRoute>} />
        <Route path="/customers/:slug" element={<ProtectedRoute><Customers /></ProtectedRoute>} />

        {/* super_admin only */}
        <Route path="/workers"  element={<ProtectedRoute requireRole="super_admin"><Workers /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute requireRole="super_admin"><Calendar /></ProtectedRoute>} />
        <Route path="/reports"  element={<ProtectedRoute requireRole="super_admin"><Reports /></ProtectedRoute>} />

        {/* settings — any signed-in user */}
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
