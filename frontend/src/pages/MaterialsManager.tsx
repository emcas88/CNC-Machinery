import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { materialsService } from '@/services/materials'
import { SearchBar } from '@/components/common/SearchBar'
import { SwatchIcon, PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'
import type { Material } from '@/types'

export function MaterialsManager() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Material | null>(null)

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: materialsService.list,
  })

  const deleteMaterial = useMutation({
    mutationFn: materialsService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materials'] }),
  })

  const filtered = materials.filter((m: Material) =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-full fade-in">
      {/* List */}
      <div className="flex flex-col w-72 border-r border-gray-800">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900">
          <SwatchIcon className="w-5 h-5 text-cyan-500" />
          <h1 className="text-sm font-semibold text-gray-200 flex-1">Materials</h1>
          <button className="btn-ghost p-1" title="Add material">
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-2 border-b border-gray-800">
          <SearchBar value={search} onChange={setSearch} placeholder="Search…" />
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-gray-600">Loading…</div>
          ) : (
            filtered.map((mat: Material) => (
              <button
                key={mat.id}
                className={`w-full text-left px-4 py-3 border-b border-gray-800 transition-colors ${
                  selected?.id === mat.id ? 'bg-cyan-900/20 text-cyan-300' : 'hover:bg-gray-800 text-gray-300'
                }`}
                onClick={() => setSelected(mat)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded shrink-0 border border-gray-700"
                    style={{ backgroundColor: mat.color ?? '#374151' }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{mat.name}</p>
                    <p className="text-xs text-gray-500">{mat.thickness}mm · {mat.category}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto p-4">
        {selected ? (
          <div className="space-y-4 max-w-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-100">{selected.name}</h2>
              <div className="flex gap-2">
                <button className="btn-secondary text-xs flex items-center gap-1.5">
                  <PencilIcon className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  className="btn-danger text-xs flex items-center gap-1.5"
                  onClick={() => { deleteMaterial.mutate(selected.id); setSelected(null) }}
                >
                  <TrashIcon className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>

            <div className="panel p-4 grid grid-cols-2 gap-3 text-sm">
              {[
                ['Category', selected.category],
                ['Thickness', `${selected.thickness}mm`],
                ['Width', `${selected.sheetWidth}mm`],
                ['Height', `${selected.sheetHeight}mm`],
                ['Cost/Sheet', selected.costPerSheet ? `$${selected.costPerSheet.toFixed(2)}` : '—'],
                ['Supplier', selected.supplier ?? '—'],
                ['Grain Direction', selected.grain ?? 'None'],
                ['Color', selected.color ?? '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-medium text-gray-200">{value}</p>
                </div>
              ))}
            </div>

            {selected.notes && (
              <div className="panel p-3">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-300">{selected.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center">
              <SwatchIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a material to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
