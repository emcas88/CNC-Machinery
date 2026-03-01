import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { quotesService } from '@/services/quotes'
import { useAppStore } from '@/store'
import { formatCurrency } from '@/utils/format'
import { PlusIcon, CurrencyDollarIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'

export function QuoteGenerator() {
  const { currentJob } = useAppStore()
  const [markupPercent, setMarkupPercent] = useState(25)
  const [taxRate, setTaxRate] = useState(10)

  const mockLines = [
    { id: '1', description: '18mm Birch Ply Sheets (×12)', category: 'Materials', quantity: 12, unit: 'sheet', unitCost: 85, total: 1020 },
    { id: '2', description: '9mm MDF Back Panels (×8)', category: 'Materials', quantity: 8, unit: 'sheet', unitCost: 42, total: 336 },
    { id: '3', description: 'Blum Clip-top Hinges (×48)', category: 'Hardware', quantity: 48, unit: 'pair', unitCost: 8.5, total: 408 },
    { id: '4', description: 'Blum Tandem Drawer Slides (×12)', category: 'Hardware', quantity: 12, unit: 'pair', unitCost: 38, total: 456 },
    { id: '5', description: 'Cabinet Handles 160mm (×24)', category: 'Hardware', quantity: 24, unit: 'ea', unitCost: 12, total: 288 },
    { id: '6', description: 'CNC Cutting Labour', category: 'Labour', quantity: 4, unit: 'hr', unitCost: 120, total: 480 },
    { id: '7', description: 'Assembly Labour', category: 'Labour', quantity: 16, unit: 'hr', unitCost: 85, total: 1360 },
    { id: '8', description: 'Installation Labour', category: 'Labour', quantity: 8, unit: 'hr', unitCost: 95, total: 760 },
  ]

  const subtotal = mockLines.reduce((s, l) => s + l.total, 0)
  const markup = subtotal * (markupPercent / 100)
  const tax = (subtotal + markup) * (taxRate / 100)
  const total = subtotal + markup + tax

  const categoryColors: Record<string, string> = {
    Materials: 'bg-blue-900/40 text-blue-300',
    Hardware: 'bg-purple-900/40 text-purple-300',
    Labour: 'bg-green-900/40 text-green-300',
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Quote Generator</h1>
          <p className="text-gray-400 mt-1">
            {currentJob ? `Job: ${currentJob.jobNumber} – ${currentJob.clientName}` : 'No job selected'}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors">
            <DocumentArrowDownIcon className="w-4 h-4" />
            Export PDF
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <PlusIcon className="w-4 h-4" />
            Add Line
          </button>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Qty</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Unit</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Unit Cost</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Total</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {mockLines.map((line) => (
              <tr key={line.id} className="hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-200">{line.description}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${categoryColors[line.category]}`}>
                    {line.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-200 text-right">{line.quantity}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{line.unit}</td>
                <td className="px-4 py-3 text-sm text-gray-200 text-right">{formatCurrency(line.unitCost)}</td>
                <td className="px-4 py-3 text-sm font-medium text-white text-right">{formatCurrency(line.total)}</td>
                <td className="px-4 py-3">
                  <button className="text-gray-500 hover:text-red-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Markup & Tax Controls */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Pricing Controls</h2>

          <div>
            <label className="flex items-center justify-between text-sm text-gray-400 mb-1">
              <span>Markup</span>
              <span className="text-white font-medium">{markupPercent}%</span>
            </label>
            <input
              type="range" min={0} max={100} value={markupPercent}
              onChange={(e) => setMarkupPercent(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label className="flex items-center justify-between text-sm text-gray-400 mb-1">
              <span>Tax Rate (GST)</span>
              <span className="text-white font-medium">{taxRate}%</span>
            </label>
            <input
              type="range" min={0} max={20} value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Totals */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <CurrencyDollarIcon className="w-4 h-4" />
            Summary
          </h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal (Cost)</span>
              <span className="text-white">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Markup ({markupPercent}%)</span>
              <span className="text-green-400">+{formatCurrency(markup)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>GST ({taxRate}%)</span>
              <span className="text-yellow-400">+{formatCurrency(tax)}</span>
            </div>
            <div className="border-t border-gray-600 pt-2 flex justify-between">
              <span className="font-semibold text-white">Total (inc. GST)</span>
              <span className="text-xl font-bold text-indigo-400">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
