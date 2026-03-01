import { PhotoIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'

export function TextureManager() {
  const textures = [
    { id: '1', name: 'Birch Ply Natural', category: 'Ply', thumbnail: '#8B7355', usedIn: 12 },
    { id: '2', name: 'White Melamine', category: 'Melamine', thumbnail: '#F5F5F0', usedIn: 8 },
    { id: '3', name: 'Oak Veneer', category: 'Veneer', thumbnail: '#C4A265', usedIn: 5 },
    { id: '4', name: 'Charcoal MDF', category: 'MDF', thumbnail: '#3D3D3D', usedIn: 3 },
    { id: '5', name: 'White Oak Solid', category: 'Solid Timber', thumbnail: '#D4B483', usedIn: 2 },
    { id: '6', name: 'Walnut Veneer', category: 'Veneer', thumbnail: '#5C3D1E', usedIn: 7 },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Texture Manager</h1>
          <p className="text-gray-400 mt-1">Manage material textures for 3D visualisation</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm">
          <ArrowUpTrayIcon className="w-4 h-4" />
          Upload Texture
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {textures.map(t => (
          <div key={t.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden cursor-pointer hover:border-indigo-500 transition-colors group">
            <div
              className="h-24 w-full"
              style={{ backgroundColor: t.thumbnail }}
            />
            <div className="p-3">
              <p className="text-xs font-medium text-white truncate">{t.name}</p>
              <p className="text-xs text-gray-400">{t.category}</p>
              <p className="text-xs text-gray-500 mt-1">Used in {t.usedIn} jobs</p>
            </div>
          </div>
        ))}

        {/* Upload slot */}
        <div className="bg-gray-800 rounded-xl border-2 border-dashed border-gray-600 overflow-hidden cursor-pointer hover:border-indigo-500 transition-colors flex flex-col items-center justify-center h-full min-h-[140px]">
          <PhotoIcon className="w-8 h-8 text-gray-500" />
          <p className="text-xs text-gray-500 mt-2">Add Texture</p>
        </div>
      </div>
    </div>
  )
}
