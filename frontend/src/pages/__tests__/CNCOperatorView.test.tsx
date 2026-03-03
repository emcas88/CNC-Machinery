import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { CNCOperatorView } from '../CNCOperatorView'

vi.mock('@/store', () => ({
  useOptimizerStore: () => ({
    sheets: [],
    selectedSheetIndex: 0,
    setSelectedSheetIndex: vi.fn(),
  }),
}))

describe('CNCOperatorView', () => {
  it('renders page heading', () => {
    render(<CNCOperatorView />)
    expect(screen.getByText('CNC Operator')).toBeInTheDocument()
  })

  it('renders sheet cutting interface subtitle', () => {
    render(<CNCOperatorView />)
    expect(screen.getByText('Sheet cutting interface')).toBeInTheDocument()
  })

  it('shows "No sheets — run optimizer first" when no sheets', () => {
    render(<CNCOperatorView />)
    expect(screen.getByText('No sheets — run optimizer first')).toBeInTheDocument()
  })

  it('renders action buttons', () => {
    render(<CNCOperatorView />)
    expect(screen.getByRole('button', { name: /print labels/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next sheet/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remake part/i })).toBeInTheDocument()
  })
})
