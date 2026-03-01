import { BellIcon, MagnifyingGlassIcon, UserCircleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useAppStore } from '@/store'
import { Link } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/jobs': 'Job Manager',
  '/room-designer': 'Room Designer',
  '/products': 'Product Editor',
  '/parts': 'Part Editor',
  '/materials': 'Materials Manager',
  '/textures': 'Texture Manager',
  '/hardware': 'Hardware Library',
  '/construction-methods': 'Construction Methods',
  '/machines': 'Machine Setup',
  '/tools': 'Tool Library',
  '/post-processors': 'Post Processors',
  '/optimizer': 'Sheet Optimizer',
  '/gcode': 'G-Code Viewer',
  '/cutlists': 'Cut Lists',
  '/bom': 'Bill of Materials',
  '/quotes': 'Quote Generator',
  '/drawings': 'Drawing Manager',
  '/labels': 'Label Designer',
  '/exports': 'Export Center',
  '/users': 'User Administration',
  '/settings': 'Settings',
  '/shop/cutlist': 'Shop – Cut List',
  '/shop/assembly': 'Shop – Assembly',
  '/shop/labels': 'Shop – Labels',
  '/cnc-operator': 'CNC Operator',
  '/render': 'Cloud Render',
  '/3d-viewer': '3D Viewer',
  '/dovetails': 'Dovetail Setup',
  '/door-profiles': 'Door Profile Editor',
  '/flipside': 'Flipside Machining',
  '/remake-bin': 'Remake Bin',
}

export function Header() {
  const { notifications, currentUser } = useAppStore()
  const unreadCount = notifications.filter((n) => !n.read).length

  // Derive page title from current path
  const path = window.location.pathname
  const title = pageTitles[path] ??
    Object.entries(pageTitles).find(([p]) => path.startsWith(p))?.[1] ??
    'CNC Cabinet Manufacturing'

  return (
    <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
      {/* Page title */}
      <h1 className="text-sm font-semibold text-gray-100 flex-1 truncate">{title}</h1>

      {/* Global search */}
      <div className="relative hidden md:flex items-center">
        <MagnifyingGlassIcon className="absolute left-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search…"
          className="input-field pl-8 w-48 text-sm"
        />
      </div>

      {/* Notifications */}
      <button className="relative text-gray-400 hover:text-gray-100 transition-colors p-1">
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Settings shortcut */}
      <Link to="/settings" className="text-gray-400 hover:text-gray-100 transition-colors p-1">
        <Cog6ToothIcon className="w-5 h-5" />
      </Link>

      {/* User avatar */}
      <button className="flex items-center gap-2 text-sm text-gray-300 hover:text-gray-100 transition-colors">
        <UserCircleIcon className="w-6 h-6 text-gray-400" />
        <span className="hidden lg:inline truncate max-w-[120px]">
          {currentUser?.name ?? 'User'}
        </span>
      </button>
    </header>
  )
}
