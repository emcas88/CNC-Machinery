import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { PostProcessorEditor } from '@/pages/PostProcessorEditor'

describe('PostProcessorEditor', () => {
  it('renders without crashing', () => {
    render(<PostProcessorEditor />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Post Processor Editor" heading', () => {
    render(<PostProcessorEditor />)
    expect(screen.getByText('Post Processor Editor')).toBeInTheDocument()
  })

  it('renders the Processors sidebar list', () => {
    render(<PostProcessorEditor />)
    expect(screen.getByText('Processors')).toBeInTheDocument()
    expect(screen.getByText('Biesse WOP/WNCE')).toBeInTheDocument()
    expect(screen.getByText('Homag WoodWOP')).toBeInTheDocument()
  })

  it('renders the code editor area with template variables', () => {
    render(<PostProcessorEditor />)
    // G-code template contains variable placeholders
    expect(screen.getByText(/JOB_NAME/)).toBeInTheDocument()
  })

  it('renders Save and Test action buttons', () => {
    render(<PostProcessorEditor />)
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /test/i })).toBeInTheDocument()
  })

  it('renders the GCODE format badge', () => {
    render(<PostProcessorEditor />)
    expect(screen.getByText('GCODE')).toBeInTheDocument()
  })

  it('renders the pre-formatted G-code template', () => {
    render(<PostProcessorEditor />)
    expect(screen.getByText(/G21 G90 G17/)).toBeInTheDocument()
  })
})
