import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useAuthStore } from '@/store/useAuthStore'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import Jobs from '@/pages/Jobs'
import Products from '@/pages/Products'
import Parts from '@/pages/Parts'
import Materials from '@/pages/Materials'
import Machines from '@/pages/Machines'
import Tools from '@/pages/Tools'
import Settings from '@/pages/Settings'

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          isAuthenticated
            ? <Navigate to="/dashboard" replace />
            : <Login />
        }
      />
      <Route
        path="/register"
        element={
          isAuthenticated
            ? <Navigate to="/dashboard" replace />
            : <Register />
        }
      />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route
          path="/dashboard"
          element={
            <AuthenticatedLayout>
              <Dashboard />
            </AuthenticatedLayout>
          }
        />
        <Route
          path="/jobs"
          element={
            <AuthenticatedLayout>
              <Jobs />
            </AuthenticatedLayout>
          }
        />
        <Route
          path="/products"
          element={
            <AuthenticatedLayout>
              <Products />
            </AuthenticatedLayout>
          }
        />
        <Route
          path="/parts"
          element={
            <AuthenticatedLayout>
              <Parts />
            </AuthenticatedLayout>
          }
        />
        <Route
          path="/materials"
          element={
            <AuthenticatedLayout>
              <Materials />
            </AuthenticatedLayout>
          }
        />
        <Route
          path="/machines"
          element={
            <AuthenticatedLayout>
              <Machines />
            </AuthenticatedLayout>
          }
        />
        <Route
          path="/tools"
          element={
            <AuthenticatedLayout>
              <Tools />
            </AuthenticatedLayout>
          }
        />
        <Route
          path="/settings"
          element={
            <AuthenticatedLayout>
              <Settings />
            </AuthenticatedLayout>
          }
        />
      </Route>

      {/* Default redirect */}
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
      />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  )
}

export default App
