import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { MultiPrintEditor } from '@/pages/MultiPrintEditor'

vi.mock('@heroicons/react/24/outline', async () => {
  const actual = await vi.importActual<typeof import('@heroicons/react/24/outline')>('@heroicons/react/24/outline')
  return {
    ...actual,
    DocumentStackIcon: actual.DocumentIcon,
  }
})

vi.mock('@/store', () => ({
  useAppStore: () => ({ currentJob: null, sidebarOpen: true }),
}))

describe('MultiPrintEditor', () => {
  const renderPage = () => render(<MultiPrintEditor />)

  it('renders without crashing', () => {
    renderPage()
    expect(document.body).toBeInTheDocument()
  })

  it('renders the Multi-Print Editor heading', () => {
    renderPage()
    expect(screen.getByText('Multi-Print Editor')).toBeInTheDocument()
  })

  it('renders the Print All button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /print all/i })).toBeInTheDocument()
  })

  it('shows "No job selected" when no current job', () => {
    renderPage()
    expect(screen.getByText('No job selected')).toBeInTheDocument()
  })

  it('renders print presets with names', () => {
    renderPage()
    expect(screen.getByText('Part Labels')).toBeInTheDocument()
    expect(screen.getByText('Cut List')).toBeInTheDocument()
    expect(screen.getByText('Bill of Materials')).toBeInTheDocument()
    expect(screen.getByText('Job Sheet')).toBeInTheDocument()
    expect(screen.getByText('Nesting Sheets')).toBeInTheDocument()
  })

  it('renders preset descriptions', () => {
    renderPage()
    expect(screen.getByText('All labels for current job')).toBeInTheDocument()
    expect(screen.getByText('Full cut list sorted by sheet')).toBeInTheDocument()
  })

  it('renders Print buttons for each preset', () => {
    renderPage()
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect(printButtons.length).toBeGreaterThan(1)
  })
})
