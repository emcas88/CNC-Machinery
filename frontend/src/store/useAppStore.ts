import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Job, Room, Product } from '@/types'

interface AppState {
  currentJob: Job | null
  currentRoom: Room | null
  selectedProduct: Product | null
  unitSystem: 'metric' | 'imperial'
  sidebarOpen: boolean
  theme: 'light' | 'dark'

  setCurrentJob: (job: Job | null) => void
  setCurrentRoom: (room: Room | null) => void
  setSelectedProduct: (product: Product | null) => void
  setUnitSystem: (system: 'metric' | 'imperial') => void
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentJob: null,
      currentRoom: null,
      selectedProduct: null,
      unitSystem: 'metric',
      sidebarOpen: true,
      theme: 'dark',

      setCurrentJob: (job) => set({ currentJob: job }),
      setCurrentRoom: (room) => set({ currentRoom: room }),
      setSelectedProduct: (product) => set({ selectedProduct: product }),
      setUnitSystem: (system) => set({ unitSystem: system }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'app-store',
      partialize: (state) => ({
        unitSystem: state.unitSystem,
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
      }),
    }
  )
)
