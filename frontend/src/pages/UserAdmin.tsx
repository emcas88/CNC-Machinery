import { useState } from 'react'
import { UserCircleIcon, PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'

type Role = 'admin' | 'manager' | 'operator' | 'viewer'

interface User {
  id: string
  name: string
  email: string
  role: Role
  status: 'active' | 'inactive'
  lastLogin: string
}

export function UserAdmin() {
  const [users] = useState<User[]>([
    { id: '1', name: 'Admin User', email: 'admin@cnc-machinery.com', role: 'admin', status: 'active', lastLogin: '2024-01-15 09:32' },
    { id: '2', name: 'Tom Robertson', email: 'tom@cnc-machinery.com', role: 'operator', status: 'active', lastLogin: '2024-01-15 08:15' },
    { id: '3', name: 'Sarah Kim', email: 'sarah@cnc-machinery.com', role: 'manager', status: 'active', lastLogin: '2024-01-14 17:45' },
    { id: '4', name: 'Mike Torres', email: 'mike@cnc-machinery.com', role: 'operator', status: 'active', lastLogin: '2024-01-15 07:55' },
    { id: '5', name: 'Inactive User', email: 'old@cnc-machinery.com', role: 'viewer', status: 'inactive', lastLogin: '2023-11-20 14:00' },
  ])

  const roleColors: Record<Role, string> = {
    admin: 'bg-red-900/40 text-red-300',
    manager: 'bg-purple-900/40 text-purple-300',
    operator: 'bg-blue-900/40 text-blue-300',
    viewer: 'bg-gray-700 text-gray-300',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Administration</h1>
          <p className="text-gray-400 mt-1">{users.filter(u => u.status === 'active').length} active users</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
          <PlusIcon className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Last Login</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <UserCircleIcon className="w-8 h-8 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-white">{user.name}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${roleColors[user.role]}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs ${
                    user.status === 'active' ? 'text-green-400' : 'text-gray-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      user.status === 'active' ? 'bg-green-400' : 'bg-gray-500'
                    }`} />
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">{user.lastLogin}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button className="p-1 text-gray-400 hover:text-white transition-colors">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-gray-400 hover:text-red-400 transition-colors">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
