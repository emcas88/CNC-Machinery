import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCircleIcon, PlusIcon, TrashIcon, PencilIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { usersService } from '@/services/users'

interface User {
  id: string
  name: string
  email: string
  role: string
}

const ROLES = ['super_admin', 'designer', 'cnc_operator', 'shop_floor'] as const
const roleColors: Record<string, string> = {
  super_admin: 'bg-red-900/40 text-red-300',
  designer: 'bg-purple-900/40 text-purple-300',
  cnc_operator: 'bg-blue-900/40 text-blue-300',
  shop_floor: 'bg-gray-700 text-gray-300',
}

export function UserAdmin() {
  const queryClient = useQueryClient()
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'designer' })

  const { data: users = [], isLoading, error } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await usersService.getUsers()
      return (res.data ?? res) as User[]
    },
    retry: false,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersService.deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) =>
      usersService.updateUser(id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditingUser(null)
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof newUser) => usersService.createUser(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setShowAddForm(false)
      setNewUser({ name: '', email: '', password: '', role: 'designer' })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
        <p>Failed to load users.</p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })}
          className="px-4 py-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Administration</h1>
          <p className="text-gray-400 mt-1">{users.length} users</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          Add User
        </button>
      </div>

      {showAddForm && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">New User</h3>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-white">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <input
              className="input-field"
              placeholder="Name"
              value={newUser.name}
              onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
            />
            <input
              className="input-field"
              placeholder="Email"
              value={newUser.email}
              onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
            />
            <input
              className="input-field"
              type="password"
              placeholder="Password"
              value={newUser.password}
              onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
            />
            <select
              className="select-field"
              value={newUser.role}
              onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {createMutation.isError && (
            <p className="text-red-400 text-sm">{(createMutation.error as Error)?.message || 'Failed to create user'}</p>
          )}
          <button
            onClick={() => createMutation.mutate(newUser)}
            disabled={!newUser.name || !newUser.email || !newUser.password || createMutation.isPending}
            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create User'}
          </button>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
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
                      {editingUser?.id === user.id ? (
                        <input
                          className="input-field text-sm w-48"
                          value={editingUser.name}
                          onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm font-medium text-white">{user.name}</p>
                      )}
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {editingUser?.id === user.id ? (
                    <select
                      className="select-field text-xs"
                      value={editingUser.role}
                      onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${roleColors[user.role] ?? 'bg-gray-700 text-gray-300'}`}>
                      {user.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    {editingUser?.id === user.id ? (
                      <>
                        <button
                          className="px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-500"
                          onClick={() => updateMutation.mutate({ id: user.id, data: { name: editingUser.name, role: editingUser.role } })}
                          disabled={updateMutation.isPending}
                        >
                          Save
                        </button>
                        <button
                          className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                          onClick={() => setEditingUser(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                          onClick={() => setEditingUser({ ...user })}
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                          onClick={() => { if (confirm(`Delete ${user.name}?`)) deleteMutation.mutate(user.id) }}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </>
                    )}
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
