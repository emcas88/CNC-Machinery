interface DimensionToolProps {
  value: number
  unit?: string
}

export function DimensionTool({ value, unit = 'mm' }: DimensionToolProps) {
  return (
    <span className="text-xs font-mono text-cyan-400 bg-gray-900/80 px-1.5 py-0.5 rounded border border-gray-700">
      {value}{unit}
    </span>
  )
}
