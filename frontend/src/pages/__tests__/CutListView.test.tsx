import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { CutListView } from '../CutListView'

describe('CutListView', () => {
  it('renders page heading', () => {
    render(<CutListView />)
    expect(screen.getByText(/cut list/i)).toBeInTheDocument()
  })

  it('renders part rows', () => {
    render(<CutListView />)
    expect(screen.getByText(/carcass|panel|shelf/i)).toBeInTheDocument()
  })

  it('renders export button', () => {
    render(<CutListView />)
    expect(screen.getByText(/export/i)).toBeInTheDocument()
  })

  it('renders dimension columns', () => {
    render(<CutListView />)
    expect(screen.getByText(/length|width|thickness/i)).toBeInTheDocument()
  })

  it('snapshot', () => {
    const { container } = render(<CutListView />)
    expect(container).toMatchSnapshot()
  })
})
