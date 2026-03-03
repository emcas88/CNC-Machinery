import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useAppStore } from '@/store'
import clsx from 'clsx'

// Pages — lazy imports for code splitting
import { lazy, Suspense } from 'react'

const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })))
const JobManager = lazy(() => import('@/pages/JobManager').then(m => ({ default: m.JobManager })))
const JobDashboard = lazy(() => import('@/pages/JobDashboard').then(m => ({ default: m.JobDashboard })))
const RoomDesigner = lazy(() => import('@/pages/RoomDesigner').then(m => ({ default: m.RoomDesigner })))
const ProductEditor = lazy(() => import('@/pages/ProductEditor').then(m => ({ default: m.ProductEditor })))
const PartEditor = lazy(() => import('@/pages/PartEditor').then(m => ({ default: m.PartEditor })))
const FloorPlanEditor = lazy(() => import('@/pages/FloorPlanEditor').then(m => ({ default: m.FloorPlanEditor })))
const ThreeDViewer = lazy(() => import('@/pages/ThreeDViewer').then(m => ({ default: m.ThreeDViewer })))
const MaterialsManager = lazy(() => import('@/pages/MaterialsManager').then(m => ({ default: m.MaterialsManager })))
const TextureManager = lazy(() => import('@/pages/TextureManager').then(m => ({ default: m.TextureManager })))
const HardwareLibrary = lazy(() => import('@/pages/HardwareLibrary').then(m => ({ default: m.HardwareLibrary })))
const ConstructionMethods = lazy(() => import('@/pages/ConstructionMethods').then(m => ({ default: m.ConstructionMethods })))
const MachineSetup = lazy(() => import('@/pages/MachineSetup').then(m => ({ default: m.MachineSetup })))
const PostProcessorEditor = lazy(() => import('@/pages/PostProcessorEditor').then(m => ({ default: m.PostProcessorEditor })))
const OptimizerView = lazy(() => import('@/pages/OptimizerView').then(m => ({ default: m.OptimizerView })))
const GCodeViewer = lazy(() => import('@/pages/GCodeViewer').then(m => ({ default: m.GCodeViewer })))
const CutListView = lazy(() => import('@/pages/CutListView').then(m => ({ default: m.CutListView })))
const BomView = lazy(() => import('@/pages/BomView').then(m => ({ default: m.BomView })))
const QuoteGenerator = lazy(() => import('@/pages/QuoteGenerator').then(m => ({ default: m.QuoteGenerator })))
const MultiPrintEditor = lazy(() => import('@/pages/MultiPrintEditor').then(m => ({ default: m.MultiPrintEditor })))
const LabelDesigner = lazy(() => import('@/pages/LabelDesigner').then(m => ({ default: m.LabelDesigner })))
const ShopCutlistApp = lazy(() => import('@/pages/ShopCutlistApp').then(m => ({ default: m.ShopCutlistApp })))
const ShopAssemblyApp = lazy(() => import('@/pages/ShopAssemblyApp').then(m => ({ default: m.ShopAssemblyApp })))
const ShopLabelApp = lazy(() => import('@/pages/ShopLabelApp').then(m => ({ default: m.ShopLabelApp })))
const CNCOperatorView = lazy(() => import('@/pages/CNCOperatorView').then(m => ({ default: m.CNCOperatorView })))
const CloudRenderView = lazy(() => import('@/pages/CloudRenderView').then(m => ({ default: m.CloudRenderView })))
const UserAdmin = lazy(() => import('@/pages/UserAdmin').then(m => ({ default: m.UserAdmin })))
const ExportCenter = lazy(() => import('@/pages/ExportCenter').then(m => ({ default: m.ExportCenter })))
const DovetailSetup = lazy(() => import('@/pages/DovetailSetup').then(m => ({ default: m.DovetailSetup })))
const DoorProfileEditor = lazy(() => import('@/pages/DoorProfileEditor').then(m => ({ default: m.DoorProfileEditor })))
const FlipsideMachining = lazy(() => import('@/pages/FlipsideMachining').then(m => ({ default: m.FlipsideMachining })))
const RemakeBin = lazy(() => import('@/pages/RemakeBin').then(m => ({ default: m.RemakeBin })))
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })))

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
      Loading…
    </div>
  )
}

export default function App() {
  const { sidebarOpen } = useAppStore()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-gray-100">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/jobs" element={<JobManager />} />
              <Route path="/jobs/:jobId" element={<JobDashboard />} />
              <Route path="/room-designer" element={<RoomDesigner />} />
              <Route path="/room-designer/:roomId" element={<RoomDesigner />} />
              <Route path="/products" element={<ProductEditor />} />
              <Route path="/products/:productId" element={<ProductEditor />} />
              <Route path="/parts" element={<PartEditor />} />
              <Route path="/parts/:partId" element={<PartEditor />} />
              <Route path="/floorplan/:roomId" element={<FloorPlanEditor />} />
              <Route path="/3d-viewer" element={<ThreeDViewer />} />
              <Route path="/materials" element={<MaterialsManager />} />
              <Route path="/textures" element={<TextureManager />} />
              <Route path="/hardware" element={<HardwareLibrary />} />
              <Route path="/construction-methods" element={<ConstructionMethods />} />
              <Route path="/machines" element={<MachineSetup />} />
              <Route path="/tools" element={<MachineSetup />} />
              <Route path="/post-processors" element={<PostProcessorEditor />} />
              <Route path="/optimizer" element={<OptimizerView />} />
              <Route path="/gcode" element={<GCodeViewer />} />
              <Route path="/cutlists" element={<CutListView />} />
              <Route path="/bom" element={<BomView />} />
              <Route path="/quotes" element={<QuoteGenerator />} />
              <Route path="/drawings" element={<MultiPrintEditor />} />
              <Route path="/labels" element={<LabelDesigner />} />
              <Route path="/shop/cutlist" element={<ShopCutlistApp />} />
              <Route path="/shop/assembly" element={<ShopAssemblyApp />} />
              <Route path="/shop/labels" element={<ShopLabelApp />} />
              <Route path="/cnc-operator" element={<CNCOperatorView />} />
              <Route path="/render" element={<CloudRenderView />} />
              <Route path="/users" element={<UserAdmin />} />
              <Route path="/exports" element={<ExportCenter />} />
              <Route path="/dovetails" element={<DovetailSetup />} />
              <Route path="/door-profiles" element={<DoorProfileEditor />} />
              <Route path="/flipside" element={<FlipsideMachining />} />
              <Route path="/remake-bin" element={<RemakeBin />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/job-manager" element={<JobManager />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
