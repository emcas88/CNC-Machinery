import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useAuthStore } from '@/store/useAuthStore'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import { Dashboard } from '@/pages/Dashboard'
import { JobManager } from '@/pages/JobManager'
import JobCreate from '@/pages/JobCreate'
import { JobDashboard } from '@/pages/JobDashboard'
import { ProductEditor } from '@/pages/ProductEditor'
import { PartEditor } from '@/pages/PartEditor'
import { MaterialsManager } from '@/pages/MaterialsManager'
import MachineSetup from '@/pages/MachineSetup'
import Tools from '@/pages/Tools'
import Settings from '@/pages/Settings'
import RoomDesigner from '@/pages/RoomDesigner'
import { ThreeDViewer } from '@/pages/ThreeDViewer'
import TextureManager from '@/pages/TextureManager'
import HardwareLibrary from '@/pages/HardwareLibrary'
import PostProcessorEditor from '@/pages/PostProcessorEditor'
import { OptimizerView } from '@/pages/OptimizerView'
import GCodeViewer from '@/pages/GCodeViewer'
import { CutListView } from '@/pages/CutListView'
import { BomView } from '@/pages/BomView'
import QuoteGenerator from '@/pages/QuoteGenerator'
import LabelDesigner from '@/pages/LabelDesigner'
import ExportCenter from '@/pages/ExportCenter'
import ShopCutlistApp from '@/pages/ShopCutlistApp'
import ShopAssemblyApp from '@/pages/ShopAssemblyApp'
import ShopLabelApp from '@/pages/ShopLabelApp'
import CNCOperatorView from '@/pages/CNCOperatorView'
import CloudRenderView from '@/pages/CloudRenderView'
import { UserAdmin } from '@/pages/UserAdmin'
import FlipsideMachining from '@/pages/FlipsideMachining'
import DoorProfileEditor from '@/pages/DoorProfileEditor'
import DovetailSetup from '@/pages/DovetailSetup'
import MultiPrintEditor from '@/pages/MultiPrintEditor'
import ConstructionMethods from '@/pages/ConstructionMethods'
import RemakeBin from '@/pages/RemakeBin'

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

function Page({ children }: { children: React.ReactNode }) {
  return (
    <AuthenticatedLayout>
      {children}
    </AuthenticatedLayout>
  )
}

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />}
      />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        {/* Main */}
        <Route path="/dashboard" element={<Page><Dashboard /></Page>} />
        <Route path="/jobs" element={<Page><JobManager /></Page>} />
        <Route path="/jobs/new" element={<Page><JobCreate /></Page>} />
        <Route path="/jobs/:jobId" element={<Page><JobDashboard /></Page>} />

        {/* Design */}
        <Route path="/room-designer" element={<Page><RoomDesigner /></Page>} />
        <Route path="/products" element={<Page><ProductEditor /></Page>} />
        <Route path="/parts" element={<Page><PartEditor /></Page>} />
        <Route path="/3d-viewer" element={<Page><ThreeDViewer /></Page>} />

        {/* Materials */}
        <Route path="/materials" element={<Page><MaterialsManager /></Page>} />
        <Route path="/textures" element={<Page><TextureManager /></Page>} />
        <Route path="/hardware" element={<Page><HardwareLibrary /></Page>} />

        {/* Machining */}
        <Route path="/machines" element={<Page><MachineSetup /></Page>} />
        <Route path="/tools" element={<Page><Tools /></Page>} />
        <Route path="/post-processors" element={<Page><PostProcessorEditor /></Page>} />
        <Route path="/optimizer" element={<Page><OptimizerView /></Page>} />
        <Route path="/gcode" element={<Page><GCodeViewer /></Page>} />
        <Route path="/flipside" element={<Page><FlipsideMachining /></Page>} />
        <Route path="/dovetail" element={<Page><DovetailSetup /></Page>} />

        {/* Output */}
        <Route path="/cutlists" element={<Page><CutListView /></Page>} />
        <Route path="/bom" element={<Page><BomView /></Page>} />
        <Route path="/quotes" element={<Page><QuoteGenerator /></Page>} />
        <Route path="/drawings" element={<Page><MultiPrintEditor /></Page>} />
        <Route path="/labels" element={<Page><LabelDesigner /></Page>} />
        <Route path="/exports" element={<Page><ExportCenter /></Page>} />

        {/* Shop Floor */}
        <Route path="/shop/cutlist" element={<Page><ShopCutlistApp /></Page>} />
        <Route path="/shop/assembly" element={<Page><ShopAssemblyApp /></Page>} />
        <Route path="/shop/labels" element={<Page><ShopLabelApp /></Page>} />
        <Route path="/cnc-operator" element={<Page><CNCOperatorView /></Page>} />

        {/* Cloud */}
        <Route path="/render" element={<Page><CloudRenderView /></Page>} />

        {/* Admin */}
        <Route path="/users" element={<Page><UserAdmin /></Page>} />
        <Route path="/settings" element={<Page><Settings /></Page>} />

        {/* Other */}
        <Route path="/construction-methods" element={<Page><ConstructionMethods /></Page>} />
        <Route path="/door-profiles" element={<Page><DoorProfileEditor /></Page>} />
        <Route path="/remake-bin" element={<Page><RemakeBin /></Page>} />
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
