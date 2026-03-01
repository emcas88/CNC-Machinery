import { PrinterIcon, QrCodeIcon } from '@heroicons/react/24/outline'

export function ShopLabelApp() {
  const labels = [
    { id: '1', partName: 'Upper Carcass Side L', job: 'JOB-2024-089', dims: '700 × 320mm', material: '18mm Birch Ply', barcode: '089-001' },
    { id: '2', partName: 'Upper Carcass Side R', job: 'JOB-2024-089', dims: '700 × 320mm', material: '18mm Birch Ply', barcode: '089-002' },
    { id: '3', partName: 'Base Carcass Side L', job: 'JOB-2024-089', dims: '870 × 560mm', material: '18mm Birch Ply', barcode: '089-003' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Shop Labels</h1>
          <p className="text-gray-400 mt-1">Print part identification labels</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm">
          <PrinterIcon className="w-4 h-4" />
          Print All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {labels.map(label => (
          <div key={label.id} className="bg-white rounded-xl p-4 text-gray-900 border-2 border-gray-200">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-lg leading-tight">{label.partName}</p>
                <p className="text-sm text-gray-600">{label.job}</p>
              </div>
              <QrCodeIcon className="w-10 h-10 text-gray-400 shrink-0" />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Dimensions</span>
                <span className="font-medium">{label.dims}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Material</span>
                <span className="font-medium">{label.material}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Barcode</span>
                <span className="font-mono text-xs bg-gray-100 px-1 rounded">{label.barcode}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
