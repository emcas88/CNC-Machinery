import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { machinesService } from '@/services/machines'
import type { Machine, MachineType, CreateMachine, AtcToolSet } from '@/types'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MACHINE_TYPES: MachineType[] = [
  'cnc_router', 'panel_saw', 'edge_bander', 'boring_machine', 'laser', 'wide_format_printer',
] as unknown as MachineType[]

function typeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/* ------------------------------------------------------------------ */
/*  Machine form                                                       */
/* ------------------------------------------------------------------ */

interface MachineFormProps {
  initial?: Machine | null
  onClose: () => void
}

function MachineFormModal({ initial, onClose }: MachineFormProps) {
  const queryClient = useQueryClient()
  const isEdit = !!initial

  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<string>(initial?.type ?? 'cnc_router')
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? '')
  const [model, setModel] = useState(initial?.model ?? '')
  const [serialNumber, setSerialNumber] = useState(initial?.serialNumber ?? '')
  const [tableWidth, setTableWidth] = useState(initial?.tableWidth ?? 0)
  const [tableHeight, setTableHeight] = useState(initial?.tableHeight ?? 0)
  const [maxCutDepth, setMaxCutDepth] = useState(initial?.maxCutDepth ?? 0)
  const [spindleCount, setSpindleCount] = useState(initial?.spindleCount ?? 1)
  const [toolPositions, setToolPositions] = useState(initial?.toolPositions ?? 0)
  const [postProcessorId, setPostProcessorId] = useState(initial?.postProcessorId ?? '')
  const [ipAddress, setIpAddress] = useState(initial?.ipAddress ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const createMutation = useMutation({
    mutationFn: (data: CreateMachine) => machinesService.createMachine(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: Partial<CreateMachine> }) => machinesService.updateMachine(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] })
      onClose()
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const isError = createMutation.isError || updateMutation.isError

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: CreateMachine = {
      name,
      type: type as MachineType,
      manufacturer: manufacturer || undefined,
      model: model || undefined,
      serialNumber: serialNumber || undefined,
      tableWidth,
      tableHeight,
      maxCutDepth: maxCutDepth || undefined,
      spindleCount: spindleCount || undefined,
      toolPositions: toolPositions || undefined,
      postProcessorId: postProcessorId || undefined,
      ipAddress: ipAddress || undefined,
      notes: notes || undefined,
    }
    if (isEdit && initial) {
      updateMutation.mutate({ id: initial.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" role="dialog" aria-label={isEdit ? 'Edit machine' : 'Add machine'}>
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-white mb-4">{isEdit ? 'Edit Machine' : 'New Machine'}</h3>

        <div className="grid grid-cols-2 gap-3">
          {/* Name */}
          <div className="col-span-2">
            <label htmlFor="m-name" className="block text-sm text-gray-400 mb-1">Name *</label>
            <input id="m-name" value={name} onChange={e => setName(e.target.value)} required
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          {/* Type */}
          <div>
            <label htmlFor="m-type" className="block text-sm text-gray-400 mb-1">Type</label>
            <select id="m-type" value={type} onChange={e => setType(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500">
              {MACHINE_TYPES.map(t => <option key={t} value={t}>{typeLabel(t as string)}</option>)}
            </select>
          </div>

          {/* Manufacturer */}
          <div>
            <label htmlFor="m-mfr" className="block text-sm text-gray-400 mb-1">Manufacturer</label>
            <input id="m-mfr" value={manufacturer} onChange={e => setManufacturer(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          {/* Model */}
          <div>
            <label htmlFor="m-model" className="block text-sm text-gray-400 mb-1">Model</label>
            <input id="m-model" value={model} onChange={e => setModel(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          {/* Serial */}
          <div>
            <label htmlFor="m-serial" className="block text-sm text-gray-400 mb-1">Serial Number</label>
            <input id="m-serial" value={serialNumber} onChange={e => setSerialNumber(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          {/* Table dimensions */}
          <div>
            <label htmlFor="m-tw" className="block text-sm text-gray-400 mb-1">Table Width (mm) *</label>
            <input id="m-tw" type="number" min={0} value={tableWidth} onChange={e => setTableWidth(Number(e.target.value))} required
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          <div>
            <label htmlFor="m-th" className="block text-sm text-gray-400 mb-1">Table Height (mm) *</label>
            <input id="m-th" type="number" min={0} value={tableHeight} onChange={e => setTableHeight(Number(e.target.value))} required
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          <div>
            <label htmlFor="m-depth" className="block text-sm text-gray-400 mb-1">Max Cut Depth (mm)</label>
            <input id="m-depth" type="number" min={0} value={maxCutDepth} onChange={e => setMaxCutDepth(Number(e.target.value))}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          <div>
            <label htmlFor="m-spindle" className="block text-sm text-gray-400 mb-1">Spindle Count</label>
            <input id="m-spindle" type="number" min={1} value={spindleCount} onChange={e => setSpindleCount(Number(e.target.value))}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          <div>
            <label htmlFor="m-tools" className="block text-sm text-gray-400 mb-1">Tool Positions</label>
            <input id="m-tools" type="number" min={0} value={toolPositions} onChange={e => setToolPositions(Number(e.target.value))}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          {/* Network */}
          <div>
            <label htmlFor="m-pp" className="block text-sm text-gray-400 mb-1">Post Processor ID</label>
            <input id="m-pp" value={postProcessorId} onChange={e => setPostProcessorId(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          <div>
            <label htmlFor="m-ip" className="block text-sm text-gray-400 mb-1">IP Address</label>
            <input id="m-ip" value={ipAddress} onChange={e => setIpAddress(e.target.value)} placeholder="192.168.1.100"
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          <div className="col-span-2">
            <label htmlFor="m-notes" className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea id="m-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
        </div>

        {isError && <p className="text-red-400 text-sm mt-3">Failed to save machine.</p>}

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
/*  ATC Tool Sets panel                                                */
/* ------------------------------------------------------------------ */

interface ToolSetsProps {
  machineId: string
  toolSets: AtcToolSet[]
}

function ToolSetsPanel({ machineId, toolSets: initialSets }: ToolSetsProps) {
  const queryClient = useQueryClient()
  const [newSetName, setNewSetName] = useState('')

  const toolSetsQuery = useQuery({
    queryKey: ['tool-sets', machineId],
    queryFn: () => machinesService.getToolSets(machineId),
    initialData: initialSets,
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => machinesService.createToolSet(machineId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-sets', machineId] })
      setNewSetName('')
    },
  })

  const sets = toolSetsQuery.data ?? []

  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4">
      <h3 className="text-sm font-semibold text-white mb-3">ATC Tool Sets</h3>
      {sets.length === 0 ? (
        <p className="text-sm text-gray-500 mb-3">No tool sets configured.</p>
      ) : (
        <ul className="space-y-1 mb-3">
          {sets.map(ts => (
            <li key={ts.id} className="text-sm text-gray-300 bg-gray-900 rounded px-3 py-1.5">{ts.name}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={newSetName}
          onChange={e => setNewSetName(e.target.value)}
          placeholder="New tool set name…"
          className="flex-1 bg-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label="New tool set name"
        />
        <button
          onClick={() => newSetName && createMutation.mutate(newSetName)}
          disabled={!newSetName || createMutation.isPending}
          className="px-3 py-1.5 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
      {createMutation.isError && <p className="text-red-400 text-sm mt-1">Failed to create tool set.</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Safety settings section                                            */
/* ------------------------------------------------------------------ */

function SafetySettings() {
  const [softLimitsEnabled, setSoftLimitsEnabled] = useState(true)
  const [spindleWarmup, setSpindleWarmup] = useState(true)
  const [dustCollection, setDustCollection] = useState(true)
  const [emergencyStopTest, setEmergencyStopTest] = useState(false)

  const toggles = [
    { label: 'Soft Limits Enabled', checked: softLimitsEnabled, set: setSoftLimitsEnabled },
    { label: 'Spindle Warmup Required', checked: spindleWarmup, set: setSpindleWarmup },
    { label: 'Dust Collection Interlock', checked: dustCollection, set: setDustCollection },
    { label: 'E-Stop Test Before Run', checked: emergencyStopTest, set: setEmergencyStopTest },
  ]

  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4">
      <h3 className="text-sm font-semibold text-white mb-3">Safety Settings</h3>
      <div className="space-y-3">
        {toggles.map(t => (
          <label key={t.label} className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-gray-300">{t.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={t.checked}
              aria-label={t.label}
              onClick={() => t.set(!t.checked)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${t.checked ? 'bg-cyan-600' : 'bg-gray-600'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${t.checked ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Machine list item                                                  */
/* ------------------------------------------------------------------ */

interface MachineListItemProps {
  machine: Machine
  isSelected: boolean
  onSelect: () => void
}

function MachineListItem({ machine, isSelected, onSelect }: MachineListItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
        isSelected ? 'bg-cyan-600/20 border border-cyan-500' : 'bg-gray-800 hover:bg-gray-700 border border-transparent'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">{machine.name}</h3>
          <p className="text-xs text-gray-400">{typeLabel(machine.type)}</p>
        </div>
        <span className={`w-2 h-2 rounded-full ${machine.isActive ? 'bg-green-400' : 'bg-gray-600'}`} aria-label={machine.isActive ? 'Active' : 'Inactive'} />
      </div>
      {machine.manufacturer && <p className="text-xs text-gray-500 mt-1">{machine.manufacturer} {machine.model ?? ''}</p>}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function MachineSetup() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null)

  /* ---- query ---- */
  const machinesQuery = useQuery({
    queryKey: ['machines'],
    queryFn: () => machinesService.getMachines(),
  })

  const machines = machinesQuery.data ?? []
  const selected = machines.find(m => m.id === selectedId) ?? machines[0] ?? null

  // Keep selection in sync
  useEffect(() => {
    if (machines.length > 0 && !selectedId) {
      setSelectedId(machines[0].id)
    }
  }, [machines, selectedId])

  /* ---- mutations ---- */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => machinesService.deleteMachine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] })
      setSelectedId(null)
    },
  })

  /* ---- guards ---- */
  if (machinesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full" role="status" aria-label="Loading machines" />
      </div>
    )
  }

  if (machinesQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-red-400 gap-3">
        <p>Failed to load machines.</p>
        <button onClick={() => machinesQuery.refetch()} className="px-4 py-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Machine Setup</h1>
        <button
          onClick={() => { setEditingMachine(null); setShowForm(true) }}
          className="px-4 py-2 text-sm rounded bg-cyan-600 hover:bg-cyan-500"
        >
          + New Machine
        </button>
      </div>

      {machines.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="text-lg mb-2">No machines configured.</p>
          <p className="text-sm">Click &ldquo;+ New Machine&rdquo; to add your first machine.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Machine list */}
          <div className="space-y-2">
            {machines.map(m => (
              <MachineListItem key={m.id} machine={m} isSelected={selected?.id === m.id} onSelect={() => setSelectedId(m.id)} />
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="lg:col-span-3">
              {/* Overview card */}
              <div className="bg-gray-800 rounded-lg p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{selected.name}</h2>
                    <p className="text-sm text-gray-400">{typeLabel(selected.type)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingMachine(selected); setShowForm(true) }}
                      className="px-3 py-1.5 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete ${selected.name}?`)) {
                          deleteMutation.mutate(selected.id)
                        }
                      }}
                      className="px-3 py-1.5 text-sm rounded bg-red-700 text-white hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 block">Manufacturer</span>
                    <span className="text-gray-200">{selected.manufacturer || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Model</span>
                    <span className="text-gray-200">{selected.model || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Serial Number</span>
                    <span className="text-gray-200">{selected.serialNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Status</span>
                    <span className={selected.isActive ? 'text-green-400' : 'text-gray-500'}>{selected.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Table Size</span>
                    <span className="text-gray-200">{selected.tableWidth} × {selected.tableHeight} mm</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Max Cut Depth</span>
                    <span className="text-gray-200">{selected.maxCutDepth} mm</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Spindles</span>
                    <span className="text-gray-200">{selected.spindleCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Tool Positions</span>
                    <span className="text-gray-200">{selected.toolPositions}</span>
                  </div>
                  {selected.ipAddress && (
                    <div>
                      <span className="text-gray-500 block">IP Address</span>
                      <span className="text-gray-200 font-mono text-xs">{selected.ipAddress}</span>
                    </div>
                  )}
                  {selected.postProcessorId && (
                    <div>
                      <span className="text-gray-500 block">Post Processor</span>
                      <span className="text-gray-200">{selected.postProcessorId}</span>
                    </div>
                  )}
                </div>

                {selected.notes && (
                  <div className="mt-4 text-sm">
                    <span className="text-gray-500">Notes:</span>
                    <p className="text-gray-300 mt-1">{selected.notes}</p>
                  </div>
                )}
              </div>

              {/* ATC Tool Sets */}
              <ToolSetsPanel machineId={selected.id} toolSets={selected.atcToolSets ?? []} />

              {/* Safety */}
              <SafetySettings />
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <MachineFormModal
          initial={editingMachine}
          onClose={() => { setShowForm(false); setEditingMachine(null) }}
        />
      )}
    </div>
  )
}
