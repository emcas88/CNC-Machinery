import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { PostProcessorEditor } from '@/pages/PostProcessorEditor'

describe('PostProcessorEditor', () => {
  const renderPage = () => render(<PostProcessorEditor />)

  it('renders without crashing', () => {
    renderPage()
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Post Processor Editor" heading', () => {
    renderPage()
    expect(screen.getByText('Post Processor Editor')).toBeInTheDocument()
  })

  it('renders the Processors sidebar list', () => {
    renderPage()
    expect(screen.getByText('Processors')).toBeInTheDocument()
    expect(screen.getAllByText(/Biesse Rover/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Homag WoodWOP/).length).toBeGreaterThan(0)
  })

  it('renders the Generic FANUC editor section with template fields', () => {
    renderPage()
    expect(screen.getByText('Header Template')).toBeInTheDocument()
    expect(screen.getByText('Tool Change')).toBeInTheDocument()
    expect(screen.getByDisplayValue('M6 T{tool}')).toBeInTheDocument()
  })

  it('renders Save Processor and Test Output buttons', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /save processor/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /test output/i })).toBeInTheDocument()
  })

  it('renders Export button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /^export$/i })).toBeInTheDocument()
  })

  it('renders + New PP button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /\+ new pp/i })).toBeInTheDocument()
  })
})
