import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { quotesService } from '@/services/quotes'
import { useAppStore } from '@/store/useAppStore'
import type { Quote, QuoteLineItem, QuoteStatus, CostEstimate, CreateQuote } from '@/types'

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-600 text-gray-200',
  sent: 'bg-blue-600 text-blue-100',
  accepted: 'bg-green-600 text-green-100',
  declined: 'bg-red-600 text-red-100',
  expired: 'bg-yellow-600 text-yellow-100',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_COLORS[status] ?? 'bg-gray-600 text-gray-200'}`}
    >
      {status}
    </span>
  )
}

/* ---------- Line-item row (view / edit) ---------- */

interface LineItemRowProps {
  item: QuoteLineItem
  onEdit: (item: QuoteLineItem) => void
  onDelete: (id: string) => void
}

function LineItemRow({ item, onEdit, onDelete }: LineItemRowProps) {
  return (
    <tr className="border-b border-gray-700 hover:bg-gray-800/50">
      <td className="px-4 py-2 text-sm text-gray-200">{item.description}</td>
      <td className="px-4 py-2 text-sm text-gray-400">{item.category}</td>
      <td className="px-4 py-2 text-sm text-gray-300 text-right">{item.quantity}</td>
      <td className="px-4 py-2 text-sm text-gray-400">{item.unit}</td>
      <td className="px-4 py-2 text-sm text-gray-300 text-right">${item.unitCost.toFixed(2)}</td>
      <td className="px-4 py-2 text-sm text-cyan-400 text-right font-medium">${item.total.toFixed(2)}</td>
      <td className="px-4 py-2 text-sm text-right space-x-2">
        <button
          onClick={() => onEdit(item)}
          className="text-cyan-400 hover:text-cyan-300"
          aria-label={`Edit ${item.description}`}
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="text-red-400 hover:text-red-300"
          aria-label={`Delete ${item.description}`}
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

/* ---------- Line-item form (add / edit) ---------- */

const EMPTY_LINE: Omit<QuoteLineItem, 'id' | 'total'> = {
  description: '',
  category: '',
  quantity: 1,
  unit: 'ea',
  unitCost: 0,
}

interface LineItemFormProps {
  initial?: QuoteLineItem | null
  onSave: (item: Omit<QuoteLineItem, 'id' | 'total'> & { id?: string }) => void
  onCancel: () => void
}

function LineItemForm({ initial, onSave, onCancel }: LineItemFormProps) {
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1)
  const [unit, setUnit] = useState(initial?.unit ?? 'ea')
  const [unitCost, setUnitCost] = useState(initial?.unitCost ?? 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ id: initial?.id, description, category, quantity, unit, unitCost })
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-6 gap-3 bg-gray-800 p-4 rounded-lg mb-4">
      <input
        className="col-span-2 bg-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 outline-none"
        placeholder="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
        required
        aria-label="Description"
      />
      <input
        className="bg-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 outline-none"
        placeholder="Category"
        value={category}
        onChange={e => setCategory(e.target.value)}
        aria-label="Category"
      />
      <input
        type="number"
        min={1}
        className="bg-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 outline-none"
        placeholder="Qty"
        value={quantity}
        onChange={e => setQuantity(Number(e.target.value))}
        aria-label="Quantity"
      />
      <input
        className="bg-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 outline-none"
        placeholder="Unit"
        value={unit}
        onChange={e => setUnit(e.target.value)}
        aria-label="Unit"
      />
      <input
        type="number"
        step="0.01"
        min={0}
        className="bg-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 outline-none"
        placeholder="Unit cost"
        value={unitCost}
        onChange={e => setUnitCost(Number(e.target.value))}
        aria-label="Unit cost"
      />
      <div className="col-span-6 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500">
          {initial ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  )
}

/* ---------- Send-quote modal ---------- */

interface SendModalProps {
  quoteId: string
  onClose: () => void
}

function SendQuoteModal({ quoteId, onClose }: SendModalProps) {
  const [email, setEmail] = useState('')
  const sendMutation = useMutation({
    mutationFn: (em: string) => quotesService.sendQuote(quoteId, em),
    onSuccess: () => onClose(),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" role="dialog" aria-label="Send quote">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-4">Send Quote to Client</h3>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="client@example.com"
          className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white mb-4 outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label="Client email"
        />
        {sendMutation.isError && <p className="text-red-400 text-sm mb-2">Failed to send quote.</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600">Cancel</button>
          <button
            onClick={() => sendMutation.mutate(email)}
            disabled={!email || sendMutation.isPending}
            className="px-4 py-2 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {sendMutation.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Create-quote modal ---------- */

interface CreateModalProps {
  jobId: string
  onClose: () => void
}

function CreateQuoteModal({ jobId, onClose }: CreateModalProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')

  const createMutation = useMutation({
    mutationFn: (data: CreateQuote) => quotesService.createQuote(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', jobId] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({ jobId, name, notes: notes || undefined, validUntil: validUntil || undefined })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" role="dialog" aria-label="Create quote">
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-4">New Quote</h3>
        <label className="block text-sm text-gray-400 mb-1">Name *</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white mb-3 outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label="Quote name"
        />
        <label className="block text-sm text-gray-400 mb-1">Valid Until</label>
        <input
          type="date"
          value={validUntil}
          onChange={e => setValidUntil(e.target.value)}
          className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white mb-3 outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label="Valid until"
        />
        <label className="block text-sm text-gray-400 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white mb-4 outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label="Notes"
        />
        {createMutation.isError && <p className="text-red-400 text-sm mb-2">Failed to create quote.</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600">Cancel</button>
          <button
            type="submit"
            disabled={!name || createMutation.isPending}
            className="px-4 py-2 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ---------- Estimate panel ---------- */

function EstimatePanel({ estimate }: { estimate: CostEstimate }) {
  const sections = [
    { label: 'Materials', items: estimate.materials },
    { label: 'Hardware', items: estimate.hardware },
    { label: 'Labour', items: estimate.labour },
    { label: 'Overheads', items: estimate.overheads },
  ]
  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4" data-testid="estimate-panel">
      <h3 className="text-sm font-semibold text-white mb-3">Cost Estimate</h3>
      {sections.map(s => (
        <div key={s.label} className="mb-3">
          <h4 className="text-xs font-medium text-gray-400 uppercase mb-1">{s.label}</h4>
          {s.items.map((b, i) => (
            <div key={i} className="flex justify-between text-sm text-gray-300">
              <span>{b.label} ({b.quantity} {b.unit})</span>
              <span>${b.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="border-t border-gray-700 pt-2 mt-2 flex justify-between text-sm font-semibold text-white">
        <span>Subtotal</span>
        <span>${estimate.subtotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-sm font-semibold text-cyan-400">
        <span>Suggested Price</span>
        <span>${estimate.suggested.toFixed(2)}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function QuoteGenerator() {
  const queryClient = useQueryClient()
  const currentJob = useAppStore(s => s.currentJob)
  const jobId = currentJob?.id ?? ''

  /* ---- local UI state ---- */
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
  const [showLineForm, setShowLineForm] = useState(false)
  const [editingLine, setEditingLine] = useState<QuoteLineItem | null>(null)
  const [showSendModal, setShowSendModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  /* ---- queries ---- */
  const quotesQuery = useQuery({
    queryKey: ['quotes', jobId],
    queryFn: () => quotesService.getQuotes(jobId),
    enabled: !!jobId,
  })

  const quotes = quotesQuery.data ?? []
  const selectedQuote = useMemo(() => quotes.find(q => q.id === selectedQuoteId) ?? quotes[0] ?? null, [quotes, selectedQuoteId])

  /* ---- mutations ---- */
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateQuote> }) => quotesService.updateQuote(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes', jobId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quotesService.deleteQuote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes', jobId] }),
  })

  const estimateMutation = useMutation({
    mutationFn: () => quotesService.generateEstimate(jobId),
  })

  /* ---- handlers ---- */
  const handleSaveLine = useCallback(
    (item: Omit<QuoteLineItem, 'id' | 'total'> & { id?: string }) => {
      if (!selectedQuote) return
      const existing = selectedQuote.lineItems ?? []
      let updated: QuoteLineItem[]

      if (item.id) {
        updated = existing.map(li =>
          li.id === item.id
            ? { ...li, ...item, total: item.quantity * item.unitCost }
            : li,
        )
      } else {
        const newItem: QuoteLineItem = {
          ...item,
          id: crypto.randomUUID(),
          total: item.quantity * item.unitCost,
        }
        updated = [...existing, newItem]
      }

      updateMutation.mutate({ id: selectedQuote.id, data: { lineItems: updated } })
      setShowLineForm(false)
      setEditingLine(null)
    },
    [selectedQuote, updateMutation],
  )

  const handleDeleteLine = useCallback(
    (lineId: string) => {
      if (!selectedQuote) return
      const updated = selectedQuote.lineItems.filter(li => li.id !== lineId)
      updateMutation.mutate({ id: selectedQuote.id, data: { lineItems: updated } })
    },
    [selectedQuote, updateMutation],
  )

  const handleExportPdf = useCallback(async () => {
    if (!selectedQuote) return
    const blob = await quotesService.exportQuote(selectedQuote.id, 'pdf')
    const url = URL.createObjectURL(blob as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedQuote.name}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }, [selectedQuote])

  const handleMarkupChange = useCallback(
    (val: number) => {
      if (!selectedQuote) return
      updateMutation.mutate({ id: selectedQuote.id, data: { markupPercent: val } })
    },
    [selectedQuote, updateMutation],
  )

  const handleTaxChange = useCallback(
    (val: number) => {
      if (!selectedQuote) return
      updateMutation.mutate({ id: selectedQuote.id, data: { taxRate: val } })
    },
    [selectedQuote, updateMutation],
  )

  /* ---- guards ---- */
  if (!jobId) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400 text-sm">
        Select a job to manage quotes.
      </div>
    )
  }

  if (quotesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full" role="status" aria-label="Loading quotes" />
      </div>
    )
  }

  if (quotesQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-red-400 gap-3">
        <p>Failed to load quotes.</p>
        <button onClick={() => quotesQuery.refetch()} className="px-4 py-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Quote Generator</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 text-sm rounded bg-cyan-600 hover:bg-cyan-500">
            + New Quote
          </button>
        </div>
      </div>

      {/* Quote selector */}
      {quotes.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="text-lg mb-2">No quotes yet.</p>
          <p className="text-sm">Click &ldquo;+ New Quote&rdquo; to create one.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {quotes.map(q => (
              <button
                key={q.id}
                onClick={() => setSelectedQuoteId(q.id)}
                className={`flex-shrink-0 px-4 py-2 rounded text-sm font-medium transition-colors ${
                  selectedQuote?.id === q.id ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {q.name} <StatusBadge status={q.status} />
              </button>
            ))}
          </div>

          {selectedQuote && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main table area */}
              <div className="lg:col-span-2">
                {/* Toolbar */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => { setEditingLine(null); setShowLineForm(true) }}
                    className="px-3 py-1.5 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
                  >
                    + Add Line
                  </button>
                  <button
                    onClick={() => estimateMutation.mutate()}
                    disabled={estimateMutation.isPending}
                    className="px-3 py-1.5 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50"
                  >
                    {estimateMutation.isPending ? 'Generating…' : 'Generate Estimate'}
                  </button>
                  <button onClick={handleExportPdf} className="px-3 py-1.5 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-200">
                    Export PDF
                  </button>
                  <button onClick={() => setShowSendModal(true)} className="px-3 py-1.5 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-200">
                    Send to Client
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this quote?')) deleteMutation.mutate(selectedQuote.id)
                    }}
                    className="px-3 py-1.5 text-sm rounded bg-red-700 hover:bg-red-600 text-white ml-auto"
                  >
                    Delete Quote
                  </button>
                </div>

                {/* Line item form */}
                {showLineForm && (
                  <LineItemForm
                    initial={editingLine}
                    onSave={handleSaveLine}
                    onCancel={() => { setShowLineForm(false); setEditingLine(null) }}
                  />
                )}

                {/* Table */}
                {selectedQuote.lineItems.length === 0 ? (
                  <div className="text-center text-gray-500 py-12 bg-gray-800 rounded-lg">No line items yet.</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="w-full">
                      <thead className="bg-gray-800">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Description</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Category</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase">Qty</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Unit</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase">Unit Cost</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase">Total</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedQuote.lineItems.map(item => (
                          <LineItemRow
                            key={item.id}
                            item={item}
                            onEdit={li => { setEditingLine(li); setShowLineForm(true) }}
                            onDelete={handleDeleteLine}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Estimate */}
                {estimateMutation.data && <EstimatePanel estimate={estimateMutation.data} />}
                {estimateMutation.isError && <p className="text-red-400 text-sm mt-2">Failed to generate estimate.</p>}
              </div>

              {/* Sidebar – totals & controls */}
              <div className="space-y-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-300">
                      <span>Subtotal</span>
                      <span>${selectedQuote.subtotal.toFixed(2)}</span>
                    </div>
                    <div>
                      <label className="flex justify-between text-gray-300 mb-1">
                        <span>Markup ({selectedQuote.markupPercent}%)</span>
                        <span>${(selectedQuote.subtotal * selectedQuote.markupPercent / 100).toFixed(2)}</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={selectedQuote.markupPercent}
                        onChange={e => handleMarkupChange(Number(e.target.value))}
                        className="w-full accent-cyan-500"
                        aria-label="Markup percent"
                      />
                    </div>
                    <div>
                      <label className="flex justify-between text-gray-300 mb-1">
                        <span>Tax ({selectedQuote.taxRate}%)</span>
                        <span>${(selectedQuote.subtotal * (1 + selectedQuote.markupPercent / 100) * selectedQuote.taxRate / 100).toFixed(2)}</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={25}
                        step={0.5}
                        value={selectedQuote.taxRate}
                        onChange={e => handleTaxChange(Number(e.target.value))}
                        className="w-full accent-cyan-500"
                        aria-label="Tax rate"
                      />
                    </div>
                    <div className="border-t border-gray-700 pt-2 flex justify-between text-white font-bold text-lg">
                      <span>Total</span>
                      <span>${selectedQuote.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Quote meta */}
                <div className="bg-gray-800 rounded-lg p-4 text-sm space-y-2">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Details</h3>
                  {selectedQuote.clientName && <div className="text-gray-300"><span className="text-gray-500">Client:</span> {selectedQuote.clientName}</div>}
                  {selectedQuote.clientEmail && <div className="text-gray-300"><span className="text-gray-500">Email:</span> {selectedQuote.clientEmail}</div>}
                  {selectedQuote.validUntil && <div className="text-gray-300"><span className="text-gray-500">Valid Until:</span> {selectedQuote.validUntil}</div>}
                  {selectedQuote.notes && <div className="text-gray-300"><span className="text-gray-500">Notes:</span> {selectedQuote.notes}</div>}
                  <div className="text-gray-500 text-xs">Created: {new Date(selectedQuote.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showSendModal && selectedQuote && <SendQuoteModal quoteId={selectedQuote.id} onClose={() => setShowSendModal(false)} />}
      {showCreateModal && <CreateQuoteModal jobId={jobId} onClose={() => setShowCreateModal(false)} />}
    </div>
  )
}
