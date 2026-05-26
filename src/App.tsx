import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Production from '@/pages/Production';
import Sales from '@/pages/Sales';
import Debts from '@/pages/Debts';
import Expenses from '@/pages/Expenses';
import Workers from '@/pages/Workers';
import Calendar from '@/pages/Calendar';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* admin + super_admin */}
      <Route path="/"          element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/production" element={<ProtectedRoute><Production /></ProtectedRoute>} />
      <Route path="/sales"     element={<ProtectedRoute><Sales /></ProtectedRoute>} />
      <Route path="/debts"     element={<ProtectedRoute><Debts /></ProtectedRoute>} />
      <Route path="/expenses"  element={<ProtectedRoute><Expenses /></ProtectedRoute>} />

      {/* super_admin only */}
      <Route path="/workers"   element={<ProtectedRoute requireRole="super_admin"><Workers /></ProtectedRoute>} />
      <Route path="/calendar"  element={<ProtectedRoute requireRole="super_admin"><Calendar /></ProtectedRoute>} />
      <Route path="/reports"   element={<ProtectedRoute requireRole="super_admin"><Reports /></ProtectedRoute>} />

      {/* settings — any signed-in user */}
      <Route path="/settings"  element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
