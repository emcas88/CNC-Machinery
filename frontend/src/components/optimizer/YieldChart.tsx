interface YieldChartProps {
  sheets: { label: string; yieldPercent: number }[]
}

export function YieldChart({ sheets }: YieldChartProps) {
  if (sheets.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-gray-600">
        No sheets to display
      </div>
    )
  }

  const avg = sheets.reduce((s, sh) => s + sh.yieldPercent, 0) / sheets.length

  return (
    <div className="p-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs text-gray-400 font-medium">Material Yield</span>
        <span className="text-xs font-mono text-cyan-400">Avg {avg.toFixed(1)}%</span>
      </div>
      <div className="space-y-1.5">
        {sheets.map((sheet, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16 shrink-0">Sheet {i + 1}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${sheet.yieldPercent}%`,
                  background:
                    sheet.yieldPercent >= 80
                      ? '#10b981'
                      : sheet.yieldPercent >= 60
                      ? '#f59e0b'
                      : '#ef4444',
                }}
              />
            </div>
            <span className="text-xs font-mono text-gray-400 w-10 text-right shrink-0">
              {sheet.yieldPercent.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
