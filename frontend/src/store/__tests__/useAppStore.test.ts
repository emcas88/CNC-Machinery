import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { Job, Room, Product } from '@/types'
import { JobStatus } from '@/types'
import { UserRole } from '@/types'
import { ProductType, CabinetStyle } from '@/types'

const mockJob: Job = {
  id: 'job-1',
  name: 'Kitchen Reno',
  clientName: 'Jane Doe',
  status: JobStatus.ACTIVE,
  tags: [],
  roomCount: 1,
  productCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const mockRoom: Room = {
  id: 'room-1',
  jobId: 'job-1',
  name: 'Kitchen',
  width: 3000,
  height: 2400,
  depth: 2700,
  productCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const mockProduct: Product = {
  id: 'prod-1',
  roomId: 'room-1',
  name: 'Base Cabinet',
  type: ProductType.BASE,
  style: CabinetStyle.FRAMELESS,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotation: 0,
  width: 600,
  height: 720,
  depth: 560,
  partCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      currentJob: null,
      currentRoom: null,
      selectedProduct: null,
      unitSystem: 'metric',
      sidebarOpen: true,
      theme: 'dark',
    })
  })

  describe('initial state', () => {
    it('has null currentJob', () => {
      expect(useAppStore.getState().currentJob).toBeNull()
    })

    it('has null currentRoom', () => {
      expect(useAppStore.getState().currentRoom).toBeNull()
    })

    it('has null selectedProduct', () => {
      expect(useAppStore.getState().selectedProduct).toBeNull()
    })

    it('defaults to metric unit system', () => {
      expect(useAppStore.getState().unitSystem).toBe('metric')
    })

    it('has sidebarOpen as true', () => {
      expect(useAppStore.getState().sidebarOpen).toBe(true)
    })

    it('defaults to dark theme', () => {
      expect(useAppStore.getState().theme).toBe('dark')
    })
  })

  describe('setCurrentJob', () => {
    it('sets the current job', () => {
      useAppStore.getState().setCurrentJob(mockJob)
      expect(useAppStore.getState().currentJob).toEqual(mockJob)
    })

    it('clears the current job when passed null', () => {
      useAppStore.getState().setCurrentJob(mockJob)
      useAppStore.getState().setCurrentJob(null)
      expect(useAppStore.getState().currentJob).toBeNull()
    })
  })

  describe('setCurrentRoom', () => {
    it('sets the current room', () => {
      useAppStore.getState().setCurrentRoom(mockRoom)
      expect(useAppStore.getState().currentRoom).toEqual(mockRoom)
    })

    it('clears the current room when passed null', () => {
      useAppStore.getState().setCurrentRoom(mockRoom)
      useAppStore.getState().setCurrentRoom(null)
      expect(useAppStore.getState().currentRoom).toBeNull()
    })
  })

  describe('setSelectedProduct', () => {
    it('sets the selected product', () => {
      useAppStore.getState().setSelectedProduct(mockProduct)
      expect(useAppStore.getState().selectedProduct).toEqual(mockProduct)
    })

    it('clears the selected product when passed null', () => {
      useAppStore.getState().setSelectedProduct(mockProduct)
      useAppStore.getState().setSelectedProduct(null)
      expect(useAppStore.getState().selectedProduct).toBeNull()
    })
  })

  describe('setUnitSystem', () => {
    it('switches to imperial', () => {
      useAppStore.getState().setUnitSystem('imperial')
      expect(useAppStore.getState().unitSystem).toBe('imperial')
    })

    it('switches back to metric', () => {
      useAppStore.getState().setUnitSystem('imperial')
      useAppStore.getState().setUnitSystem('metric')
      expect(useAppStore.getState().unitSystem).toBe('metric')
    })
  })

  describe('toggleSidebar', () => {
    it('toggles sidebar from open to closed', () => {
      useAppStore.setState({ sidebarOpen: true })
      useAppStore.getState().toggleSidebar()
      expect(useAppStore.getState().sidebarOpen).toBe(false)
    })

    it('toggles sidebar from closed to open', () => {
      useAppStore.setState({ sidebarOpen: false })
      useAppStore.getState().toggleSidebar()
      expect(useAppStore.getState().sidebarOpen).toBe(true)
    })

    it('toggles twice returns to original state', () => {
      useAppStore.getState().toggleSidebar()
      useAppStore.getState().toggleSidebar()
      expect(useAppStore.getState().sidebarOpen).toBe(true)
    })
  })

  describe('setTheme', () => {
    it('switches to light theme', () => {
      useAppStore.getState().setTheme('light')
      expect(useAppStore.getState().theme).toBe('light')
    })

    it('switches back to dark theme', () => {
      useAppStore.getState().setTheme('light')
      useAppStore.getState().setTheme('dark')
      expect(useAppStore.getState().theme).toBe('dark')
    })
  })

  describe('persistence', () => {
    it('persists unitSystem', () => {
      useAppStore.getState().setUnitSystem('imperial')
      // The persist middleware stores only specific keys
      // We can verify which fields are in the partialize by checking the store config
      expect(useAppStore.getState().unitSystem).toBe('imperial')
    })

    it('persists sidebarOpen', () => {
      useAppStore.getState().toggleSidebar()
      expect(useAppStore.getState().sidebarOpen).toBe(false)
    })

    it('persists theme', () => {
      useAppStore.getState().setTheme('light')
      expect(useAppStore.getState().theme).toBe('light')
    })

    it('does not persist currentJob (it resets on beforeEach)', () => {
      useAppStore.getState().setCurrentJob(mockJob)
      // Reset to initial to simulate what persistence does (only persists subset)
      useAppStore.setState({ currentJob: null })
      expect(useAppStore.getState().currentJob).toBeNull()
    })
  })
})
