import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { ProductLibraryTree, LibraryItem } from '@/components/design/ProductLibraryTree'

const mockItems: LibraryItem[] = [
  {
    id: 'cat-1',
    name: 'Base Cabinets',
    type: 'category',
    children: [
      { id: 'prod-1', name: 'Base Cabinet 600', type: 'product' },
      { id: 'prod-2', name: 'Base Cabinet 900', type: 'product' },
    ],
  },
  {
    id: 'cat-2',
    name: 'Wall Cabinets',
    type: 'category',
    children: [
      { id: 'prod-3', name: 'Wall Cabinet 600', type: 'product' },
    ],
  },
]

describe('ProductLibraryTree', () => {
  it('renders top-level items', () => {
    render(<ProductLibraryTree items={mockItems} />)
    expect(screen.getByText('Base Cabinets')).toBeInTheDocument()
    expect(screen.getByText('Wall Cabinets')).toBeInTheDocument()
  })

  it('does not show children before expanding', () => {
    render(<ProductLibraryTree items={mockItems} />)
    expect(screen.queryByText('Base Cabinet 600')).not.toBeInTheDocument()
  })

  it('expands a category on click and shows children', () => {
    render(<ProductLibraryTree items={mockItems} />)
    fireEvent.click(screen.getByText('Base Cabinets'))
    expect(screen.getByText('Base Cabinet 600')).toBeInTheDocument()
    expect(screen.getByText('Base Cabinet 900')).toBeInTheDocument()
  })

  it('collapses an expanded category on second click', () => {
    render(<ProductLibraryTree items={mockItems} />)
    fireEvent.click(screen.getByText('Base Cabinets'))
    fireEvent.click(screen.getByText('Base Cabinets'))
    expect(screen.queryByText('Base Cabinet 600')).not.toBeInTheDocument()
  })

  it('calls onSelect when an item is clicked', () => {
    const onSelect = vi.fn()
    render(<ProductLibraryTree items={mockItems} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Base Cabinets'))
    fireEvent.click(screen.getByText('Base Cabinet 600'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'prod-1' }))
  })

  it('filters items based on search query', () => {
    render(<ProductLibraryTree items={mockItems} />)
    fireEvent.change(screen.getByPlaceholderText('Search library…'), {
      target: { value: 'Wall' },
    })
    expect(screen.getByText('Wall Cabinets')).toBeInTheDocument()
    expect(screen.queryByText('Base Cabinets')).not.toBeInTheDocument()
  })
})
