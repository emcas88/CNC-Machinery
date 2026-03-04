import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hardwareService } from '@/services/hardware'
import type { Hardware, HardwareType, CreateHardware, HardwareCategory } from '@/types'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const HARDWARE_TYPES: HardwareType[] = [
  'hinge', 'slide', 'handle', 'knob', 'lock', 'clip', 'dowel', 'screw',
  'cam_lock', 'shelf_pin', 'soft_close', 'push_open', 'lazy_susan', 'other',
] as unknown as HardwareType[]

function typeLabel(type: string | undefined | null): string {
  if (!type) return 'Other'
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/* ------------------------------------------------------------------ */
/*  Hardware form modal                                                */
/* ------------------------------------------------------------------ */

interface HardwareFormModalProps {
  initial?: Hardware | null
  onClose: () => void
}

function HardwareFormModal({ initial, onClose }: HardwareFormModalProps) {
  const queryClient = useQueryClient()
  const isEdit = !!initial

  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<string>(initial?.type ?? 'hinge')
  const [sku, setSku] = useState(initial?.sku ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [costPerUnit, setCostPerUnit] = useState(initial?.costPerUnit ?? 0)
  const [inStock, setInStock] = useState(initial?.inStock ?? true)
  const [brandId, setBrandId] = useState(initial?.brandId ?? '')
  const [drillingX, setDrillingX] = useState(initial?.drillingX ?? 0)
  const [drillingY, setDrillingY] = useState(initial?.drillingY ?? 0)
  const [drillingDiameter, setDrillingDiameter] = useState(initial?.drillingDiameter ?? 0)
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const createMutation = useMutation({
    mutationFn: (data: CreateHardware) => hardwareService.createHardware(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hardware'] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: Partial<CreateHardware> }) => hardwareService.updateHardware(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hardware'] })
      onClose()
    },
  })

  const mutation = isEdit ? updateMutation : createMutation
  const isPending = createMutation.isPending || updateMutation.isPending
  const isError = createMutation.isError || updateMutation.isError

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: CreateHardware = {
      name,
      type: type as HardwareType,
      sku: sku || undefined,
      description: description || undefined,
      costPerUnit,
      inStock,
      brandId: brandId || undefined,
      drillingX: drillingX || undefined,
      drillingY: drillingY || undefined,
      drillingDiameter: drillingDiameter || undefined,
      notes: notes || undefined,
    }
    if (isEdit && initial) {
      updateMutation.mutate({ id: initial.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" role="dialog" aria-label={isEdit ? 'Edit hardware' : 'Add hardware'}>
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-white mb-4">{isEdit ? 'Edit Hardware' : 'Add Hardware'}</h3>

        <div className="grid grid-cols-2 gap-3">
          {/* Name */}
          <div className="col-span-2">
            <label htmlFor="hw-name" className="block text-sm text-gray-400 mb-1">Name *</label>
            <input id="hw-name" value={name} onChange={e => setName(e.target.value)} required
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          {/* Type */}
          <div>
            <label htmlFor="hw-type" className="block text-sm text-gray-400 mb-1">Type</label>
            <select id="hw-type" value={type} onChange={e => setType(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500">
              {HARDWARE_TYPES.map(t => <option key={t} value={t}>{typeLabel(t as string)}</option>)}
            </select>
          </div>

          {/* SKU */}
          <div>
            <label htmlFor="hw-sku" className="block text-sm text-gray-400 mb-1">SKU</label>
            <input id="hw-sku" value={sku} onChange={e => setSku(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          {/* Cost */}
          <div>
            <label htmlFor="hw-cost" className="block text-sm text-gray-400 mb-1">Cost / Unit ($)</label>
            <input id="hw-cost" type="number" step="0.01" min={0} value={costPerUnit} onChange={e => setCostPerUnit(Number(e.target.value))}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          {/* In stock */}
          <div className="flex items-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} className="accent-cyan-500" />
              In Stock
            </label>
          </div>

          {/* Brand ID */}
          <div className="col-span-2">
            <label htmlFor="hw-brand" className="block text-sm text-gray-400 mb-1">Brand ID</label>
            <input id="hw-brand" value={brandId} onChange={e => setBrandId(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          {/* Description */}
          <div className="col-span-2">
            <label htmlFor="hw-desc" className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea id="hw-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          {/* Drilling pattern */}
          <div className="col-span-2">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Drilling Pattern</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="hw-dx" className="block text-xs text-gray-500 mb-1">X (mm)</label>
                <input id="hw-dx" type="number" step="0.1" value={drillingX} onChange={e => setDrillingX(Number(e.target.value))}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div>
                <label htmlFor="hw-dy" className="block text-xs text-gray-500 mb-1">Y (mm)</label>
                <input id="hw-dy" type="number" step="0.1" value={drillingY} onChange={e => setDrillingY(Number(e.target.value))}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div>
                <label htmlFor="hw-dd" className="block text-xs text-gray-500 mb-1">Diameter (mm)</label>
                <input id="hw-dd" type="number" step="0.1" value={drillingDiameter} onChange={e => setDrillingDiameter(Number(e.target.value))}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="col-span-2">
            <label htmlFor="hw-notes" className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea id="hw-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
        </div>

        {isError && <p className="text-red-400 text-sm mt-3">Failed to save hardware item.</p>}

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600">Cancel</button>
          <button type="submit" disabled={!name || isPending}
            className="px-4 py-2 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50">
            {isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Delete confirmation modal                                          */
/* ------------------------------------------------------------------ */

interface DeleteConfirmProps {
  item: Hardware
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

function DeleteConfirmModal({ item, onConfirm, onCancel, isPending }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" role="dialog" aria-label="Confirm delete">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-2">Delete Hardware</h3>
        <p className="text-sm text-gray-400 mb-4">Are you sure you want to delete <strong className="text-white">{item.name}</strong>?</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600">Cancel</button>
          <button onClick={onConfirm} disabled={isPending}
            className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-500 disabled:opacity-50">
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Hardware card                                                      */
/* ------------------------------------------------------------------ */

interface HardwareCardProps {
  item: Hardware
  onEdit: () => void
  onDelete: () => void
}

function HardwareCard({ item, onEdit, onDelete }: HardwareCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-2 hover:ring-1 hover:ring-cyan-500/30 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{item.name}</h3>
          <span className="text-xs text-gray-500">{typeLabel(item.type)}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.inStock ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
          {item.inStock ? 'In Stock' : 'Out of Stock'}
        </span>
      </div>

      {item.sku && <p className="text-xs text-gray-500">SKU: {item.sku}</p>}
      {item.description && <p className="text-xs text-gray-400 line-clamp-2">{item.description}</p>}

      <div className="text-sm text-cyan-400 font-medium">${(item.costPerUnit ?? 0).toFixed(2)} / unit</div>

      {/* Drilling info */}
      {(item.drillingX || item.drillingY || item.drillingDiameter) && (
        <div className="text-xs text-gray-500 bg-gray-900 rounded p-2">
          Drilling: {item.drillingX ?? '–'} × {item.drillingY ?? '–'} mm, ⌀ {item.drillingDiameter ?? '–'} mm
        </div>
      )}

      <div className="flex gap-2 mt-auto pt-2">
        <button onClick={onEdit} className="flex-1 px-3 py-1.5 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600">Edit</button>
        <button onClick={onDelete} className="flex-1 px-3 py-1.5 text-xs rounded bg-gray-700 text-red-400 hover:bg-gray-600">Delete</button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function HardwareLibrary() {
  const queryClient = useQueryClient()

  /* ---- state ---- */
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<Hardware | null>(null)
  const [deletingItem, setDeletingItem] = useState<Hardware | null>(null)

  /* ---- queries ---- */
  const hardwareQuery = useQuery({
    queryKey: ['hardware'],
    queryFn: () => hardwareService.getHardware(),
  })

  const categoriesQuery = useQuery({
    queryKey: ['hardware-categories'],
    queryFn: () => hardwareService.getHardwareCategories(),
  })

  /* ---- mutations ---- */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => hardwareService.deleteHardware(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hardware'] })
      setDeletingItem(null)
    },
  })

  /* ---- derived ---- */
  const allItems = hardwareQuery.data ?? []

  const filtered = useMemo(() => {
    let items = allItems
    if (typeFilter !== 'all') {
      items = items.filter(h => h.type === typeFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(h => h.name.toLowerCase().includes(q) || (h.sku && h.sku.toLowerCase().includes(q)))
    }
    return items
  }, [allItems, typeFilter, search])

  /* ---- guards ---- */
  if (hardwareQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full" role="status" aria-label="Loading hardware" />
      </div>
    )
  }

  if (hardwareQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-red-400 gap-3">
        <p>Failed to load hardware library.</p>
        <button onClick={() => hardwareQuery.refetch()} className="px-4 py-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Hardware Library</h1>
        <button onClick={() => { setEditingItem(null); setShowForm(true) }} className="px-4 py-2 text-sm rounded bg-cyan-600 hover:bg-cyan-500">
          + Add Hardware
        </button>
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or SKU…"
          className="flex-1 min-w-[200px] bg-gray-800 rounded px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label="Search hardware"
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-gray-800 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label="Filter by type"
        >
          <option value="all">All Types</option>
          {HARDWARE_TYPES.map(t => (
            <option key={t} value={t}>{typeLabel(t as string)}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          {allItems.length === 0 ? (
            <>
              <p className="text-lg mb-2">No hardware items yet.</p>
              <p className="text-sm">Click &ldquo;+ Add Hardware&rdquo; to add your first item.</p>
            </>
          ) : (
            <p className="text-lg">No items match your search.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(item => (
            <HardwareCard
              key={item.id}
              item={item}
              onEdit={() => { setEditingItem(item); setShowForm(true) }}
              onDelete={() => setDeletingItem(item)}
            />
          ))}
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-gray-500 mt-4">
        Showing {filtered.length} of {allItems.length} items
      </p>

      {/* Modals */}
      {showForm && (
        <HardwareFormModal
          initial={editingItem}
          onClose={() => { setShowForm(false); setEditingItem(null) }}
        />
      )}

      {deletingItem && (
        <DeleteConfirmModal
          item={deletingItem}
          onConfirm={() => deleteMutation.mutate(deletingItem.id)}
          onCancel={() => setDeletingItem(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
