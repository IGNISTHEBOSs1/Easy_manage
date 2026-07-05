import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Fees from './pages/Fees'
import Attendance from './pages/Attendance'
import Expenses from './pages/Expenses'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import { ForgotPassword, ResetPassword } from './pages/auth/ResetPassword'

// Anti-flash theme script — runs before React hydrates
;(function () {
  const t = localStorage.getItem('coachpro-theme')
  if (t === 'dark') document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
})()

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public auth routes ───────────────────────── */}
          <Route path="/login"           element={<Login />} />
          <Route path="/signup"          element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />

          {/* ── Protected app routes ─────────────────────── */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index           element={<Dashboard />} />
            <Route path="students"   element={<Students />} />
            <Route path="fees"       element={<Fees />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="expenses"   element={<Expenses />} />
          </Route>

          {/* ── Fallback ─────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
