import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { PartsList } from '@/components/optimizer/PartsList'
import type { Part } from '@/types'
import { PartType, GrainDirection } from '@/types'

const mockParts: Part[] = [
  {
    id: 'p1',
    name: 'Left Side Panel',
    width: 560,
    height: 720,
    thickness: 18,
    quantity: 2,
    grainDirection: GrainDirection.VERTICAL,
    type: PartType.PANEL,
    materialId: 'mat-1',
    productId: 'prod-1',
    edgeBanding: { top: false, bottom: false, left: false, right: false },
    operations: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p2',
    name: 'Top Panel',
    width: 560,
    height: 480,
    thickness: 18,
    quantity: 1,
    grainDirection: GrainDirection.HORIZONTAL,
    type: PartType.PANEL,
    materialId: 'mat-1',
    productId: 'prod-1',
    edgeBanding: { top: false, bottom: false, left: false, right: false },
    operations: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
]

describe('PartsList', () => {
  it('renders the "Parts" header label', () => {
    render(<PartsList parts={mockParts} />)
    expect(screen.getByText('Parts')).toBeInTheDocument()
  })

  it('displays the correct parts count in the header', () => {
    render(<PartsList parts={mockParts} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders each part name', () => {
    render(<PartsList parts={mockParts} />)
    expect(screen.getByText('Left Side Panel')).toBeInTheDocument()
    expect(screen.getByText('Top Panel')).toBeInTheDocument()
  })

  it('renders the part dimensions in monospace format', () => {
    render(<PartsList parts={mockParts} />)
    expect(screen.getByText('560 × 720 × 18mm')).toBeInTheDocument()
  })

  it('renders the quantity for each part', () => {
    render(<PartsList parts={mockParts} />)
    expect(screen.getByText('×2')).toBeInTheDocument()
    expect(screen.getByText('×1')).toBeInTheDocument()
  })

  it('shows the empty state message when parts array is empty', () => {
    render(<PartsList parts={[]} />)
    expect(screen.getByText('No parts')).toBeInTheDocument()
  })

  it('shows "0" count in header when parts array is empty', () => {
    render(<PartsList parts={[]} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('calls onSelect with the part id when a part button is clicked', () => {
    const onSelect = vi.fn()
    render(<PartsList parts={mockParts} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Left Side Panel'))
    expect(onSelect).toHaveBeenCalledWith('p1')
  })

  it('highlights the selected part with cyan classes', () => {
    render(<PartsList parts={mockParts} selectedPartId="p1" />)
    const button = screen.getByText('Left Side Panel').closest('button')!
    expect(button.className).toMatch(/cyan/)
  })

  it('does not highlight a non-selected part', () => {
    render(<PartsList parts={mockParts} selectedPartId="p1" />)
    const button = screen.getByText('Top Panel').closest('button')!
    expect(button.className).not.toMatch(/bg-cyan-900/)
  })
})
