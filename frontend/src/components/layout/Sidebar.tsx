import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import {
  HomeIcon,
  BriefcaseIcon,
  CubeIcon,
  PuzzlePieceIcon,
  SwatchIcon,
  PhotoIcon,
  WrenchScrewdriverIcon,
  CpuChipIcon,
  DocumentTextIcon,
  PrinterIcon,
  ShoppingCartIcon,
  UsersIcon,
  Cog6ToothIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  BuildingStorefrontIcon,
  CloudIcon,
  ArrowDownTrayIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import { useAppStore } from '@/store'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
}

interface NavGroup {
  group: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    group: 'Main',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: <HomeIcon className="w-4 h-4" /> },
      { label: 'Jobs', to: '/jobs', icon: <BriefcaseIcon className="w-4 h-4" /> },
    ],
  },
  {
    group: 'Design',
    items: [
      { label: 'Room Designer', to: '/room-designer', icon: <HomeIcon className="w-4 h-4" /> },
      { label: 'Products', to: '/products', icon: <CubeIcon className="w-4 h-4" /> },
      { label: 'Parts', to: '/parts', icon: <PuzzlePieceIcon className="w-4 h-4" /> },
      { label: '3D Viewer', to: '/3d-viewer', icon: <CubeIcon className="w-4 h-4" /> },
    ],
  },
  {
    group: 'Materials',
    items: [
      { label: 'Materials', to: '/materials', icon: <SwatchIcon className="w-4 h-4" /> },
      { label: 'Textures', to: '/textures', icon: <PhotoIcon className="w-4 h-4" /> },
      { label: 'Hardware', to: '/hardware', icon: <WrenchScrewdriverIcon className="w-4 h-4" /> },
    ],
  },
  {
    group: 'Machining',
    items: [
      { label: 'Machines', to: '/machines', icon: <CpuChipIcon className="w-4 h-4" /> },
      { label: 'Post Processors', to: '/post-processors', icon: <DocumentTextIcon className="w-4 h-4" /> },
      { label: 'Optimizer', to: '/optimizer', icon: <CpuChipIcon className="w-4 h-4" /> },
      { label: 'G-Code', to: '/gcode', icon: <DocumentTextIcon className="w-4 h-4" /> },
    ],
  },
  {
    group: 'Output',
    items: [
      { label: 'Cut Lists', to: '/cutlists', icon: <DocumentTextIcon className="w-4 h-4" /> },
      { label: 'BOM', to: '/bom', icon: <ShoppingCartIcon className="w-4 h-4" /> },
      { label: 'Quotes', to: '/quotes', icon: <ShoppingCartIcon className="w-4 h-4" /> },
      { label: 'Drawings', to: '/drawings', icon: <PrinterIcon className="w-4 h-4" /> },
      { label: 'Labels', to: '/labels', icon: <TagIcon className="w-4 h-4" /> },
      { label: 'Exports', to: '/exports', icon: <ArrowDownTrayIcon className="w-4 h-4" /> },
    ],
  },
  {
    group: 'Shop Floor',
    items: [
      { label: 'Cut List App', to: '/shop/cutlist', icon: <BuildingStorefrontIcon className="w-4 h-4" /> },
      { label: 'Assembly App', to: '/shop/assembly', icon: <BuildingStorefrontIcon className="w-4 h-4" /> },
      { label: 'Labels App', to: '/shop/labels', icon: <BuildingStorefrontIcon className="w-4 h-4" /> },
      { label: 'CNC Operator', to: '/cnc-operator', icon: <CpuChipIcon className="w-4 h-4" /> },
    ],
  },
  {
    group: 'Cloud',
    items: [
      { label: 'Cloud Render', to: '/render', icon: <CloudIcon className="w-4 h-4" /> },
    ],
  },
  {
    group: 'Admin',
    items: [
      { label: 'Users', to: '/users', icon: <UsersIcon className="w-4 h-4" /> },
      { label: 'Settings', to: '/settings', icon: <Cog6ToothIcon className="w-4 h-4" /> },
    ],
  },
]

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore()

  return (
    <aside
      className={clsx(
        'bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200 shrink-0',
        sidebarOpen ? 'w-48' : 'w-12'
      )}
    >
      {/* Logo / brand */}
      <div className="h-12 flex items-center justify-between px-2 border-b border-gray-800 shrink-0">
        {sidebarOpen && (
          <span className="text-sm font-bold text-cyan-400 truncate">CNC Cabinet</span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1 text-gray-400 hover:text-gray-100 transition-colors ml-auto"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen
            ? <ChevronDoubleLeftIcon className="w-4 h-4" />
            : <ChevronDoubleRightIcon className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group) => (
          <div key={group.group} className="mb-3">
            {sidebarOpen && (
              <div className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {group.group}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={!sidebarOpen ? item.label : undefined}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-lg mx-1 transition-colors',
                    isActive
                      ? 'bg-cyan-900/40 text-cyan-300'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                  )
                }
              >
                {item.icon}
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
