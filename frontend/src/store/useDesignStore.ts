import { create } from 'zustand'
import type { Product } from '@/types'

interface DesignState {
  products: Product[]
  selectedProductId: string | null
  undoStack: Product[][]
  redoStack: Product[][]

  setProducts: (products: Product[]) => void
  addProduct: (product: Product) => void
  updateProduct: (id: string, data: Partial<Product>) => void
  removeProduct: (id: string) => void
  selectProduct: (id: string | null) => void
  moveProduct: (id: string, x: number, y: number, z: number) => void
  rotateProduct: (id: string, rotation: number) => void
  undo: () => void
  redo: () => void
}

export const useDesignStore = create<DesignState>()((set) => ({
  products: [],
  selectedProductId: null,
  undoStack: [],
  redoStack: [],

  setProducts: (products) => set({ products, undoStack: [], redoStack: [] }),

  addProduct: (product) =>
    set((s) => ({
      products: [...s.products, product],
      undoStack: [...s.undoStack, s.products],
      redoStack: [],
    })),

  updateProduct: (id, data) =>
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? { ...p, ...data } : p)),
      undoStack: [...s.undoStack, s.products],
      redoStack: [],
    })),

  removeProduct: (id) =>
    set((s) => ({
      products: s.products.filter((p) => p.id !== id),
      selectedProductId: s.selectedProductId === id ? null : s.selectedProductId,
      undoStack: [...s.undoStack, s.products],
      redoStack: [],
    })),

  selectProduct: (id) => set({ selectedProductId: id }),

  moveProduct: (id, x, y, z) =>
    set((s) => ({
      products: s.products.map((p) =>
        p.id === id ? { ...p, positionX: x, positionY: y, positionZ: z } : p
      ),
      undoStack: [...s.undoStack, s.products],
      redoStack: [],
    })),

  rotateProduct: (id, rotation) =>
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? { ...p, rotation } : p)),
      undoStack: [...s.undoStack, s.products],
      redoStack: [],
    })),

  undo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return s
      const prev = s.undoStack[s.undoStack.length - 1]
      return {
        products: prev,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, s.products],
      }
    }),

  redo: () =>
    set((s) => {
      if (s.redoStack.length === 0) return s
      const next = s.redoStack[s.redoStack.length - 1]
      return {
        products: next,
        undoStack: [...s.undoStack, s.products],
        redoStack: s.redoStack.slice(0, -1),
      }
    }),
}))
