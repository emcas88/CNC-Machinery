import { useRef, useEffect, useCallback } from 'react'
import type { NestedSheet } from '@/types'

interface SheetViewerProps {
  sheet: NestedSheet
  scale?: number
  selectedPartId?: string | null
  onPartClick?: (partId: string) => void
}

const PART_COLORS = [
  '#1e40af', '#065f46', '#7c2d12', '#4a1d96',
  '#1e3a5f', '#064e3b', '#6b21a8', '#92400e',
  '#0c4a6e', '#134e4a',
]

export function SheetViewer({ sheet, scale = 1, selectedPartId, onPartClick }: SheetViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const displayWidth = sheet.sheetWidth * scale
    const displayHeight = sheet.sheetHeight * scale

    canvas.width = displayWidth
    canvas.height = displayHeight

    // Sheet background
    ctx.fillStyle = '#1a1d27'
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    // Sheet border
    ctx.strokeStyle = '#3a3d4a'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, displayWidth - 1, displayHeight - 1)

    // Parts
    sheet.parts.forEach((part, index) => {
      const x = part.x * scale
      const y = part.y * scale
      const w = (part.rotated ? part.height : part.width) * scale
      const h = (part.rotated ? part.width : part.height) * scale

      const isSelected = part.partId === selectedPartId
      const color = PART_COLORS[index % PART_COLORS.length]

      ctx.fillStyle = isSelected ? '#0e7490' : color
      ctx.globalAlpha = isSelected ? 0.9 : 0.7
      ctx.fillRect(x, y, w, h)
      ctx.globalAlpha = 1

      ctx.strokeStyle = isSelected ? '#06b6d4' : '#ffffff30'
      ctx.lineWidth = isSelected ? 2 : 1
      ctx.strokeRect(x, y, w, h)

      // Label
      if (w > 40 && h > 20) {
        ctx.fillStyle = '#ffffffcc'
        ctx.font = `${Math.min(11, Math.floor(h * 0.3))}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const label = part.partName.slice(0, 12)
        ctx.fillText(label, x + w / 2, y + h / 2)
      }
    })

    // Yield text
    ctx.fillStyle = '#6b7280'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText(
      `Yield: ${sheet.yieldPercent.toFixed(1)}%  |  ${sheet.parts.length} parts`,
      4,
      displayHeight - 4
    )
  }, [sheet, scale, selectedPartId])

  useEffect(() => {
    draw()
  }, [draw])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onPartClick) return
      const rect = canvasRef.current!.getBoundingClientRect()
      const mx = (e.clientX - rect.left) / scale
      const my = (e.clientY - rect.top) / scale

      const hit = sheet.parts.find((p) => {
        const pw = p.rotated ? p.height : p.width
        const ph = p.rotated ? p.width : p.height
        return mx >= p.x && mx <= p.x + pw && my >= p.y && my <= p.y + ph
      })
      if (hit) onPartClick(hit.partId)
    },
    [onPartClick, scale, sheet.parts]
  )

  return (
    <canvas
      ref={canvasRef}
      className="sheet-svg max-w-full"
      style={{ cursor: onPartClick ? 'pointer' : 'default', imageRendering: 'pixelated' }}
      onClick={handleClick}
    />
  )
}
