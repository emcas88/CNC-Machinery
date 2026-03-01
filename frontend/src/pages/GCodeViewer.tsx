import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gcodeService } from '@/services/gcode'
import { useAppStore } from '@/store'
import { PlayIcon, PauseIcon, BackwardIcon, CommandLineIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export function GCodeViewer() {
  const { currentJob } = useAppStore()
  const [activeLine, setActiveLine] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const { data: files = [] } = useQuery({
    queryKey: ['gcode-files', currentJob?.id],
    queryFn: () => gcodeService.listFiles(currentJob!.id),
    enabled: !!currentJob?.id,
  })

  const { data: lines = [] } = useQuery({
    queryKey: ['gcode', selectedFile],
    queryFn: () => gcodeService.getFile(selectedFile!),
    enabled: !!selectedFile,
  })

  const gcodeColorClass = (line: string) => {
    const l = line.trim()
    if (l.startsWith(';')) return 'text-gray-600'
    if (l.startsWith('G0') || l.startsWith('G00')) return 'text-blue-400'
    if (l.startsWith('G1') || l.startsWith('G01')) return 'text-green-400'
    if (l.startsWith('G2') || l.startsWith('G02') || l.startsWith('G3') || l.startsWith('G03')) return 'text-yellow-400'
    if (l.startsWith('M')) return 'text-purple-400'
    if (l.startsWith('T') || l.startsWith('S') || l.startsWith('F')) return 'text-cyan-400'
    return 'text-gray-300'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-900">
        <CommandLineIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">G-Code Viewer</h1>
        <div className="flex-1" />
        {/* File selector */}
        <select
          className="select-field text-xs w-48"
          value={selectedFile ?? ''}
          onChange={e => setSelectedFile(e.target.value || null)}
        >
          <option value="">Select file…</option>
          {files.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        {/* Playback controls */}
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost p-1.5"
            onClick={() => setActiveLine(0)}
            title="Reset"
          >
            <BackwardIcon className="w-4 h-4" />
          </button>
          <button
            className="btn-ghost p-1.5"
            onClick={() => setIsPlaying(p => !p)}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
          </button>
        </div>
        <span className="text-xs text-gray-500 mono">Line {activeLine + 1} / {lines.length}</span>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Code panel */}
        <div className="w-1/2 overflow-auto bg-gray-950 border-r border-gray-800">
          {lines.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              {selectedFile ? 'Loading…' : 'Select a file to view G-Code'}
            </div>
          ) : (
            <div className="py-2">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className={clsx(
                    'gcode-line cursor-pointer select-none',
                    i === activeLine && 'active',
                    gcodeColorClass(line)
                  )}
                  onClick={() => setActiveLine(i)}
                >
                  <span className="text-gray-700 mr-3 select-none text-xs">{String(i + 1).padStart(4, ' ')}</span>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3D preview placeholder */}
        <div className="flex-1 flex items-center justify-center bg-gray-950">
          <div className="text-center text-gray-700">
            <svg width="120" height="100" viewBox="0 0 120 100">
              <polygon points="60,10 110,40 110,80 60,90 10,80 10,40" fill="none" stroke="#374151" strokeWidth="1.5" />
              <line x1="60" y1="10" x2="60" y2="90" stroke="#374151" strokeWidth="1" strokeDasharray="3,3" />
              <line x1="10" y1="40" x2="110" y2="40" stroke="#374151" strokeWidth="1" strokeDasharray="3,3" />
            </svg>
            <p className="text-xs mt-2">3D preview coming soon</p>
          </div>
        </div>
      </div>
    </div>
  )
}
