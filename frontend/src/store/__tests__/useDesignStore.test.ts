import { describe, it, expect, beforeEach } from 'vitest'
import { useDesignStore } from '@/store/useDesignStore'
import type { Product } from '@/types'
import { ProductType, CabinetStyle } from '@/types'

const makeProduct = (id: string, name = `Product ${id}`): Product => ({
  id,
  roomId: 'room-1',
  name,
  type: ProductType.BASE,
  style: CabinetStyle.FRAMELESS,
  width: 600,
  height: 720,
  depth: 560,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotation: 0,
  partCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

describe('useDesignStore', () => {
  beforeEach(() => {
    useDesignStore.setState({
      products: [],
      selectedProductId: null,
      undoStack: [],
      redoStack: [],
    })
  })

  describe('initial state', () => {
    it('has empty products array', () => {
      expect(useDesignStore.getState().products).toEqual([])
    })

    it('has null selectedProductId', () => {
      expect(useDesignStore.getState().selectedProductId).toBeNull()
    })

    it('has empty undo stack', () => {
      expect(useDesignStore.getState().undoStack).toEqual([])
    })

    it('has empty redo stack', () => {
      expect(useDesignStore.getState().redoStack).toEqual([])
    })
  })

  describe('setProducts', () => {
    it('replaces the products array', () => {
      const products = [makeProduct('1'), makeProduct('2')]
      useDesignStore.getState().setProducts(products)
      expect(useDesignStore.getState().products).toEqual(products)
    })

    it('clears undo stack', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().setProducts([makeProduct('2')])
      expect(useDesignStore.getState().undoStack).toEqual([])
    })

    it('clears redo stack', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().undo()
      useDesignStore.getState().setProducts([makeProduct('2')])
      expect(useDesignStore.getState().redoStack).toEqual([])
    })
  })

  describe('addProduct', () => {
    it('appends a product to the array', () => {
      const product = makeProduct('1')
      useDesignStore.getState().addProduct(product)
      expect(useDesignStore.getState().products).toHaveLength(1)
      expect(useDesignStore.getState().products[0]).toEqual(product)
    })

    it('appends multiple products', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().addProduct(makeProduct('2'))
      expect(useDesignStore.getState().products).toHaveLength(2)
    })

    it('pushes an undo snapshot before adding', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      expect(useDesignStore.getState().undoStack).toHaveLength(1)
      // Snapshot captured empty array
      expect(useDesignStore.getState().undoStack[0]).toEqual([])
    })

    it('clears redo stack when adding after undo', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().undo()
      expect(useDesignStore.getState().redoStack).toHaveLength(1)
      useDesignStore.getState().addProduct(makeProduct('2'))
      expect(useDesignStore.getState().redoStack).toEqual([])
    })
  })

  describe('updateProduct', () => {
    it('updates product by id', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().updateProduct('1', { name: 'Updated Name' })
      const updated = useDesignStore.getState().products.find((p) => p.id === '1')
      expect(updated?.name).toBe('Updated Name')
    })

    it('does not change other products', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().addProduct(makeProduct('2'))
      useDesignStore.getState().updateProduct('1', { name: 'Changed' })
      const p2 = useDesignStore.getState().products.find((p) => p.id === '2')
      expect(p2?.name).toBe('Product 2')
    })

    it('pushes an undo snapshot before updating', () => {
      useDesignStore.setState({ products: [makeProduct('1')], undoStack: [], redoStack: [] })
      useDesignStore.getState().updateProduct('1', { name: 'New' })
      expect(useDesignStore.getState().undoStack).toHaveLength(1)
    })
  })

  describe('removeProduct', () => {
    it('removes product by id', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().addProduct(makeProduct('2'))
      useDesignStore.getState().removeProduct('1')
      const ids = useDesignStore.getState().products.map((p) => p.id)
      expect(ids).not.toContain('1')
      expect(ids).toContain('2')
    })

    it('clears selectedProductId when removed product was selected', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().selectProduct('1')
      useDesignStore.getState().removeProduct('1')
      expect(useDesignStore.getState().selectedProductId).toBeNull()
    })

    it('pushes an undo snapshot before removing', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.setState({ undoStack: [] })
      useDesignStore.getState().removeProduct('1')
      expect(useDesignStore.getState().undoStack).toHaveLength(1)
    })
  })

  describe('selectProduct', () => {
    it('sets selectedProductId', () => {
      useDesignStore.getState().selectProduct('abc')
      expect(useDesignStore.getState().selectedProductId).toBe('abc')
    })

    it('deselects when passed null', () => {
      useDesignStore.getState().selectProduct('abc')
      useDesignStore.getState().selectProduct(null)
      expect(useDesignStore.getState().selectedProductId).toBeNull()
    })
  })

  describe('undo / redo', () => {
    it('undoes the last operation', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().undo()
      expect(useDesignStore.getState().products).toEqual([])
    })

    it('does nothing on undo when stack is empty', () => {
      useDesignStore.getState().undo()
      expect(useDesignStore.getState().products).toEqual([])
    })

    it('redoes after undo', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().undo()
      useDesignStore.getState().redo()
      expect(useDesignStore.getState().products).toHaveLength(1)
    })

    it('does nothing on redo when stack is empty', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().redo()
      expect(useDesignStore.getState().products).toHaveLength(1)
    })

    it('clears redo stack after new action post-undo', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().undo()
      useDesignStore.getState().addProduct(makeProduct('2'))
      useDesignStore.getState().redo()
      expect(useDesignStore.getState().products).toHaveLength(1)
      expect(useDesignStore.getState().products[0].id).toBe('2')
    })

    it('supports multiple undo levels', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().addProduct(makeProduct('2'))
      useDesignStore.getState().addProduct(makeProduct('3'))
      useDesignStore.getState().undo()
      useDesignStore.getState().undo()
      expect(useDesignStore.getState().products).toHaveLength(1)
    })
  })

  describe('moveProduct', () => {
    it('updates position fields', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().moveProduct('1', 100, 200, 300)
      const p = useDesignStore.getState().products.find((p) => p.id === '1')
      expect(p?.positionX).toBe(100)
      expect(p?.positionY).toBe(200)
      expect(p?.positionZ).toBe(300)
    })

    it('pushes undo snapshot', () => {
      useDesignStore.setState({ products: [makeProduct('1')], undoStack: [], redoStack: [] })
      useDesignStore.getState().moveProduct('1', 10, 20, 30)
      expect(useDesignStore.getState().undoStack).toHaveLength(1)
    })
  })

  describe('rotateProduct', () => {
    it('updates rotation field', () => {
      useDesignStore.getState().addProduct(makeProduct('1'))
      useDesignStore.getState().rotateProduct('1', 90)
      const p = useDesignStore.getState().products.find((p) => p.id === '1')
      expect(p?.rotation).toBe(90)
    })
  })
})
