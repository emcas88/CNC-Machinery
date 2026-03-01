import { useCallback, useState } from 'react'
import { CloudArrowUpIcon, DocumentIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface FileUploadProps {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  className?: string
  label?: string
  disabled?: boolean
}

export function FileUpload({
  onFiles,
  accept,
  multiple = false,
  className,
  label = 'Drop files here or click to upload',
  disabled = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length) {
        setDroppedFiles(files)
        onFiles(files)
      }
    },
    [onFiles]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (files.length) {
        setDroppedFiles(files)
        onFiles(files)
      }
    },
    [onFiles]
  )

  return (
    <label
      className={clsx(
        'flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
        isDragging
          ? 'border-cyan-500 bg-cyan-900/20'
          : 'border-gray-700 bg-gray-900 hover:border-gray-500',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <CloudArrowUpIcon className="w-10 h-10 text-gray-500" />
      <p className="text-sm text-gray-400">{label}</p>
      {droppedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {droppedFiles.map((f) => (
            <span key={f.name} className="flex items-center gap-1 text-xs text-cyan-400 bg-cyan-900/30 px-2 py-0.5 rounded">
              <DocumentIcon className="w-3 h-3" />
              {f.name}
            </span>
          ))}
        </div>
      )}
      <input
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        disabled={disabled}
      />
    </label>
  )
}
