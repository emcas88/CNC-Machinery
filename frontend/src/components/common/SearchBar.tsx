import { useState } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onClear?: () => void
}

export function SearchBar({ value, onChange, placeholder = 'Search...', className, onClear }: SearchBarProps) {
  return (
    <div className={clsx('relative flex items-center', className)}>
      <MagnifyingGlassIcon className="absolute left-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field pl-8 pr-7 w-full"
      />
      {value && (
        <button
          className="absolute right-2 text-gray-500 hover:text-gray-300 transition-colors"
          onClick={() => { onChange(''); onClear?.() }}
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
