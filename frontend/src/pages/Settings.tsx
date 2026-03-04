import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersService } from '@/services/users'
import { useAppStore } from '@/store/useAppStore'
import type { User } from '@/types'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TABS = ['Profile', 'Security', 'Notifications', 'Appearance', 'System'] as const
type Tab = (typeof TABS)[number]

const NOTIFICATION_DEFAULTS = {
  emailQuoteAccepted: true,
  emailJobComplete: true,
  emailWeeklyReport: false,
  pushNewJob: true,
  pushErrors: true,
}

type NotificationPrefs = typeof NOTIFICATION_DEFAULTS

function loadNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem('cnc_notification_prefs')
    return raw ? { ...NOTIFICATION_DEFAULTS, ...JSON.parse(raw) } : { ...NOTIFICATION_DEFAULTS }
  } catch {
    return { ...NOTIFICATION_DEFAULTS }
  }
}

function saveNotificationPrefs(prefs: NotificationPrefs) {
  localStorage.setItem('cnc_notification_prefs', JSON.stringify(prefs))
}

/* ------------------------------------------------------------------ */
/*  Tab panels                                                         */
/* ------------------------------------------------------------------ */

/* ---- Profile ---- */

function ProfileTab({ user }: { user: User }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setName(user.name); setEmail(user.email) }, [user])

  const mutation = useMutation({
    mutationFn: (data: { name: string; email: string }) => usersService.updateUser(user.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({ name, email })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold text-white">Profile</h2>

      <div>
        <label htmlFor="profile-name" className="block text-sm text-gray-400 mb-1">Name</label>
        <input
          id="profile-name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500"
          required
        />
      </div>

      <div>
        <label htmlFor="profile-email" className="block text-sm text-gray-400 mb-1">Email</label>
        <input
          id="profile-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500"
          required
        />
      </div>

      <div className="text-sm text-gray-500">
        <span>Role: {user.role}</span>
        {user.lastLogin && <span className="ml-4">Last login: {new Date(user.lastLogin).toLocaleString()}</span>}
      </div>

      {mutation.isError && <p className="text-red-400 text-sm">Failed to save profile.</p>}
      {saved && <p className="text-green-400 text-sm">Profile saved.</p>}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="px-4 py-2 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
      >
        {mutation.isPending ? 'Saving…' : 'Save Profile'}
      </button>
    </form>
  )
}

/* ---- Security ---- */

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saved, setSaved] = useState(false)
  const [mismatch, setMismatch] = useState(false)

  const mutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => usersService.changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => {
      setSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    mutation.mutate({ currentPassword, newPassword })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold text-white">Security</h2>

      <div>
        <label htmlFor="current-password" className="block text-sm text-gray-400 mb-1">Current Password</label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500"
          required
        />
      </div>

      <div>
        <label htmlFor="new-password" className="block text-sm text-gray-400 mb-1">New Password</label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500"
          required
          minLength={8}
        />
      </div>

      <div>
        <label htmlFor="confirm-password" className="block text-sm text-gray-400 mb-1">Confirm Password</label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500"
          required
        />
      </div>

      {mismatch && <p className="text-red-400 text-sm">Passwords do not match.</p>}
      {mutation.isError && <p className="text-red-400 text-sm">Failed to change password.</p>}
      {saved && <p className="text-green-400 text-sm">Password changed.</p>}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="px-4 py-2 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
      >
        {mutation.isPending ? 'Changing…' : 'Change Password'}
      </button>
    </form>
  )
}

/* ---- Notifications ---- */

function NotificationsTab() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadNotificationPrefs)
  const [saved, setSaved] = useState(false)

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = () => {
    saveNotificationPrefs(prefs)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const labels: Record<keyof NotificationPrefs, string> = {
    emailQuoteAccepted: 'Email when quote is accepted',
    emailJobComplete: 'Email when job is complete',
    emailWeeklyReport: 'Weekly summary email',
    pushNewJob: 'Push notification for new jobs',
    pushErrors: 'Push notification for errors',
  }

  return (
    <div className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold text-white">Notifications</h2>
      {(Object.keys(labels) as (keyof NotificationPrefs)[]).map(key => (
        <label key={key} className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-300">{labels[key]}</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs[key]}
            aria-label={labels[key]}
            onClick={() => toggle(key)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs[key] ? 'bg-cyan-600' : 'bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${prefs[key] ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </label>
      ))}
      {saved && <p className="text-green-400 text-sm">Preferences saved.</p>}
      <button onClick={handleSave} className="px-4 py-2 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500">
        Save Preferences
      </button>
    </div>
  )
}

/* ---- Appearance ---- */

function AppearanceTab() {
  const theme = useAppStore(s => s.theme)
  const unitSystem = useAppStore(s => s.unitSystem)
  const setTheme = useAppStore(s => s.setTheme)
  const setUnitSystem = useAppStore(s => s.setUnitSystem)

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-lg font-semibold text-white">Appearance</h2>

      {/* Theme */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">Theme</label>
        <div className="flex gap-3">
          {(['dark', 'light'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-4 py-2 rounded text-sm capitalize ${theme === t ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              aria-pressed={theme === t}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Units */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">Unit System</label>
        <div className="flex gap-3">
          {(['metric', 'imperial'] as const).map(u => (
            <button
              key={u}
              onClick={() => setUnitSystem(u)}
              className={`px-4 py-2 rounded text-sm capitalize ${unitSystem === u ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              aria-pressed={unitSystem === u}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---- System ---- */

function SystemTab() {
  return (
    <div className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold text-white">System Information</h2>
      <div className="bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-300">
          <span className="text-gray-500">App Version</span>
          <span>2.0.0</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span className="text-gray-500">API Version</span>
          <span>v2</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span className="text-gray-500">Environment</span>
          <span>{import.meta.env.MODE ?? 'production'}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span className="text-gray-500">Build</span>
          <span>{import.meta.env.VITE_BUILD_HASH ?? 'N/A'}</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('Profile')

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => usersService.me(),
    retry: false,
  })

  if (meQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full" role="status" aria-label="Loading settings" />
      </div>
    )
  }

  if (meQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-red-400 gap-3">
        <p>Failed to load settings.</p>
        <button onClick={() => meQuery.refetch()} className="px-4 py-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm">
          Retry
        </button>
      </div>
    )
  }

  const user = meQuery.data!

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-700 mb-6">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              activeTab === tab
                ? 'bg-gray-800 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        {activeTab === 'Profile' && <ProfileTab user={user} />}
        {activeTab === 'Security' && <SecurityTab />}
        {activeTab === 'Notifications' && <NotificationsTab />}
        {activeTab === 'Appearance' && <AppearanceTab />}
        {activeTab === 'System' && <SystemTab />}
      </div>
    </div>
  )
}
