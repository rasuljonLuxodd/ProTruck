import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { useEffect } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useRealtimeSync } from '@/data/useRealtimeSync';
import { supabase } from '@/data/supabaseClient';
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import Production from '@/pages/Production';
import Sales from '@/pages/Sales';
import Debts from '@/pages/Debts';
import Expenses from '@/pages/Expenses';
import Workers from '@/pages/Workers';
import Calendar from '@/pages/Calendar';
import Reports from '@/pages/Reports';
import Customers from '@/pages/Customers';
import Settings from '@/pages/Settings';

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
      <Route path="/customers"        element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/customers/:slug"  element={<ProtectedRoute><Customers /></ProtectedRoute>} />

      {/* super_admin only */}
      <Route path="/workers"  element={<ProtectedRoute requireRole="super_admin"><Workers /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute requireRole="super_admin"><Calendar /></ProtectedRoute>} />
      <Route path="/reports"  element={<ProtectedRoute requireRole="super_admin"><Reports /></ProtectedRoute>} />

      {/* settings — any signed-in user */}
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
