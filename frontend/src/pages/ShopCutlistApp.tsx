import { useState } from 'react'
import { PrinterIcon, CheckIcon } from '@heroicons/react/24/outline'

interface CutItem {
  id: string
  partName: string
  material: string
  length: number
  width: number
  qty: number
  edging: string
  cut: boolean
}

export function ShopCutlistApp() {
  const [items, setItems] = useState<CutItem[]>([
    { id: '1', partName: 'Upper Carcass Side', material: '18mm Birch Ply', length: 700, width: 320, qty: 2, edging: 'Top', cut: false },
    { id: '2', partName: 'Upper Carcass Top/Bottom', material: '18mm Birch Ply', length: 900, width: 320, qty: 2, edging: 'Front', cut: false },
    { id: '3', partName: 'Upper Back Panel', material: '9mm MDF', length: 900, width: 700, qty: 1, edging: 'None', cut: true },
    { id: '4', partName: 'Base Carcass Side', material: '18mm Birch Ply', length: 870, width: 560, qty: 2, edging: 'Top, Front', cut: false },
    { id: '5', partName: 'Base Carcass Bottom', material: '18mm Birch Ply', length: 900, width: 560, qty: 1, edging: 'Front', cut: true },
    { id: '6', partName: 'Shelf', material: '18mm Birch Ply', length: 864, width: 320, qty: 3, edging: 'Front', cut: false },
  ])

  const toggleCut = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, cut: !i.cut } : i))
  }

  const cutCount = items.filter(i => i.cut).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Shop Cutlist</h1>
          <p className="text-gray-400 mt-1">{cutCount}/{items.length} parts cut</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors text-sm">
          <PrinterIcon className="w-4 h-4" />
          Print Cutlist
        </button>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-700 rounded-full h-2">
        <div
          className="bg-green-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(cutCount / items.length) * 100}%` }}
        />
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Part Name</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Material</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">L × W (mm)</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Qty</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Edging</th>
              <th className="text-center px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Cut?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {items.map(item => (
              <tr key={item.id} className={`transition-colors ${item.cut ? 'opacity-50' : ''}`}>
                <td className={`px-4 py-3 text-gray-200 ${item.cut ? 'line-through' : ''}`}>{item.partName}</td>
                <td className="px-4 py-3 text-gray-400">{item.material}</td>
                <td className="px-4 py-3 text-gray-200 text-right">{item.length} × {item.width}</td>
                <td className="px-4 py-3 text-gray-200 text-right">{item.qty}</td>
                <td className="px-4 py-3 text-gray-400">{item.edging}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleCut(item.id)}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                      item.cut ? 'bg-green-500 border-green-500' : 'border-gray-500 hover:border-green-400'
                    }`}
                  >
                    {item.cut && <CheckIcon className="w-4 h-4 text-white" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
