import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { SheetViewer } from '@/components/optimizer/SheetViewer'
import type { NestedSheet } from '@/types'

const mockSheet: NestedSheet = {
  id: 'sheet-1',
  runId: 'run-1',
  sheetIndex: 0,
  materialId: 'mat-1',
  materialName: 'Birch Ply 18mm',
  sheetWidth: 2440,
  sheetHeight: 1220,
  thickness: 18,
  yieldPercent: 72.5,
  parts: [
    {
      partId: 'part-1',
      partName: 'Left Side',
      width: 560,
      height: 720,
      x: 10,
      y: 10,
      rotated: false,
    },
    {
      partId: 'part-2',
      partName: 'Top Panel',
      width: 560,
      height: 480,
      x: 580,
      y: 10,
      rotated: false,
    },
  ],
}

const emptySheet: NestedSheet = {
  id: 'sheet-2',
  runId: 'run-1',
  sheetIndex: 1,
  materialId: 'mat-1',
  materialName: 'Birch Ply 18mm',
  sheetWidth: 2440,
  sheetHeight: 1220,
  thickness: 18,
  yieldPercent: 0,
  parts: [],
}

describe('SheetViewer', () => {
  it('renders a canvas element', () => {
    const { container } = render(<SheetViewer sheet={mockSheet} />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('renders without crashing when parts array is empty', () => {
    const { container } = render(<SheetViewer sheet={emptySheet} />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('renders with a custom scale without crashing', () => {
    const { container } = render(<SheetViewer sheet={mockSheet} scale={0.2} />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('renders with a selectedPartId prop without crashing', () => {
    const { container } = render(
      <SheetViewer sheet={mockSheet} selectedPartId="part-1" />
    )
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('applies pointer cursor style when onPartClick is provided', () => {
    const { container } = render(
      <SheetViewer sheet={mockSheet} onPartClick={vi.fn()} />
    )
    const canvas = container.querySelector('canvas')!
    expect(canvas.style.cursor).toBe('pointer')
  })

  it('applies default cursor when no onPartClick is provided', () => {
    const { container } = render(<SheetViewer sheet={mockSheet} />)
    const canvas = container.querySelector('canvas')!
    expect(canvas.style.cursor).toBe('default')
  })

  it('applies the sheet-svg CSS class to the canvas', () => {
    const { container } = render(<SheetViewer sheet={mockSheet} />)
    const canvas = container.querySelector('canvas')!
    expect(canvas).toHaveClass('sheet-svg')
  })
})
