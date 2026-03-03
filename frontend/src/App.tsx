import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { lazy, Suspense, useEffect } from 'react'
import { useAuthStore } from '@/store/useAuthStore'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Machines = lazy(() => import('@/pages/Machines'))
const Jobs = lazy(() => import('@/pages/Jobs'))
const Materials = lazy(() => import('@/pages/Materials'))
const Tools = lazy(() => import('@/pages/Tools'))
const Operators = lazy(() => import('@/pages/Operators'))
const Maintenance = lazy(() => import('@/pages/Maintenance'))
const QualityControl = lazy(() => import('@/pages/QualityControl'))
const Production = lazy(() => import('@/pages/Production'))
const Inventory = lazy(() => import('@/pages/Inventory'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const Settings = lazy(() => import('@/pages/Settings'))
const UserManagement = lazy(() => import('@/pages/UserManagement'))
const Login = lazy(() => import('@/pages/Login'))
const Register = lazy(() => import('@/pages/Register'))

export default function App() {
  const { initAuth } = useAuthStore()

  useEffect(() => {
    initAuth()
  }, [initAuth])

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading...</div>}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <div className="flex h-screen bg-gray-900">
              <Sidebar />
              <div className="flex-1 flex flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-auto p-6">
                  <Routes>
                    <Route index element={<Dashboard />} />
                    <Route path="machines" element={<Machines />} />
                    <Route path="jobs" element={<Jobs />} />
                    <Route path="materials" element={<Materials />} />
                    <Route path="tools" element={<Tools />} />
                    <Route path="operators" element={<Operators />} />
                    <Route path="maintenance" element={<Maintenance />} />
                    <Route path="quality" element={<QualityControl />} />
                    <Route path="production" element={<Production />} />
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="users" element={<UserManagement />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            </div>
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
