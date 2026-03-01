import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline'

const HARDWARE = [
  { id: '1', name: 'Blum Tandembox Antaro 450mm', category: 'Drawer System', supplier: 'Blum', sku: 'TB450-W', price: 89.50 },
  { id: '2', name: 'Blum Clip Top 110° Hinge', category: 'Hinge', supplier: 'Blum', sku: 'BL70T3550', price: 12.40 },
  { id: '3', name: 'Salice 170° Hinge', category: 'Hinge', supplier: 'Salice', sku: 'S4C6E99', price: 15.20 },
  { id: '4', name: 'Häfele Minifix 15 Cam Lock', category: 'Connector', supplier: 'Häfele', sku: '262.12.202', price: 1.85 },
  { id: '5', name: 'Häfele Rafix Dowel', category: 'Connector', supplier: 'Häfele', sku: '262.08.101', price: 0.45 },
  { id: '6', name: 'Grass Nova Pro Scala 450mm', category: 'Drawer System', supplier: 'Grass', sku: 'NP450-W', price: 95.00 },
]

export function HardwareLibrary() {
  return (
    <div className="flex flex-col h-full fade-in">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <WrenchScrewdriverIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">Hardware Library</h1>
        <div className="flex-1" />
        <button className="btn-primary text-xs">+ Add Hardware</button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Supplier</th>
              <th>SKU</th>
              <th>Unit Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {HARDWARE.map(h => (
              <tr key={h.id}>
                <td className="font-medium text-gray-100">{h.name}</td>
                <td><span className="badge bg-gray-700 text-gray-300">{h.category}</span></td>
                <td className="text-gray-400">{h.supplier}</td>
                <td className="mono text-xs">{h.sku}</td>
                <td className="mono text-cyan-400">${h.price.toFixed(2)}</td>
                <td><button className="btn-ghost text-xs">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
