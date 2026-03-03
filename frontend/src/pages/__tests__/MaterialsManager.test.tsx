import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { MaterialsManager } from '../MaterialsManager'

vi.mock('@/services/materials', () => ({
  materialsService: {
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
  },
}))

describe('MaterialsManager', () => {
  it('renders without crashing', () => {
    render(<MaterialsManager />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Materials" heading', () => {
    render(<MaterialsManager />)
    expect(screen.getByText('Materials')).toBeInTheDocument()
  })

  it('renders a search bar for filtering materials', () => {
    render(<MaterialsManager />)
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()
  })

  it('shows "Select a material to view details" when none selected', async () => {
    render(<MaterialsManager />)
    expect(await screen.findByText('Select a material to view details')).toBeInTheDocument()
  })
})
