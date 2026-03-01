import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import { MaterialsManager } from '@/pages/MaterialsManager'

describe('MaterialsManager', () => {
  it('renders without crashing', () => {
    render(<MaterialsManager />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Materials Library" heading', () => {
    render(<MaterialsManager />)
    expect(screen.getByText('Materials Library')).toBeInTheDocument()
  })

  it('renders a search bar for filtering materials', () => {
    render(<MaterialsManager />)
    expect(screen.getByPlaceholderText(/search materials/i)).toBeInTheDocument()
  })

  it('renders the category filter dropdown', () => {
    render(<MaterialsManager />)
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThan(0)
  })

  it('renders the "Add Material" button', () => {
    render(<MaterialsManager />)
    expect(screen.getByRole('button', { name: /add material/i })).toBeInTheDocument()
  })

  it('shows material data after loading', async () => {
    render(<MaterialsManager />)
    await waitFor(() => {
      expect(screen.getByText('Birch Ply 18mm')).toBeInTheDocument()
    })
  })

  it('renders column headers in the material table', async () => {
    render(<MaterialsManager />)
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Thickness')).toBeInTheDocument()
    })
  })

  it('opens the "Add Material" modal when the button is clicked', async () => {
    render(<MaterialsManager />)
    const addBtn = screen.getByRole('button', { name: /add material/i })
    addBtn.click()
    await waitFor(() => {
      expect(screen.getByText('Add Material')).toBeInTheDocument()
    })
  })
})
