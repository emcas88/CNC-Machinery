import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { CanvasToolbar } from '@/components/design/CanvasToolbar'

describe('CanvasToolbar', () => {
  const defaultProps = {
    activeTool: 'select' as const,
    onToolChange: vi.fn(),
  }

  it('renders all tool buttons', () => {
    render(<CanvasToolbar {...defaultProps} />)
    expect(screen.getByTitle('Select (V)')).toBeInTheDocument()
    expect(screen.getByTitle('Pan (H)')).toBeInTheDocument()
    expect(screen.getByTitle('Zoom In (+)')).toBeInTheDocument()
    expect(screen.getByTitle('Zoom Out (-)')).toBeInTheDocument()
    expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeInTheDocument()
    expect(screen.getByTitle('Redo (Ctrl+Shift+Z)')).toBeInTheDocument()
  })

  it('calls onToolChange when a tool button is clicked', () => {
    const onToolChange = vi.fn()
    render(<CanvasToolbar activeTool="select" onToolChange={onToolChange} />)
    fireEvent.click(screen.getByTitle('Pan (H)'))
    expect(onToolChange).toHaveBeenCalledWith('pan')
  })

  it('shows the active tool with active styling', () => {
    render(<CanvasToolbar activeTool="pan" onToolChange={vi.fn()} />)
    const panBtn = screen.getByTitle('Pan (H)')
    expect(panBtn.className).toMatch(/bg-cyan-700/)
  })

  it('undo button is disabled when canUndo=false', () => {
    render(<CanvasToolbar {...defaultProps} canUndo={false} />)
    expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeDisabled()
  })

  it('undo button is enabled when canUndo=true', () => {
    render(<CanvasToolbar {...defaultProps} canUndo={true} />)
    expect(screen.getByTitle('Undo (Ctrl+Z)')).not.toBeDisabled()
  })

  it('renders Fit View button when onFitView is provided', () => {
    render(<CanvasToolbar {...defaultProps} onFitView={vi.fn()} />)
    expect(screen.getByTitle('Fit View (F)')).toBeInTheDocument()
  })

  it('does not render Fit View button when onFitView is omitted', () => {
    render(<CanvasToolbar {...defaultProps} />)
    expect(screen.queryByTitle('Fit View (F)')).not.toBeInTheDocument()
  })

  it('calls onFitView when Fit View is clicked', () => {
    const onFitView = vi.fn()
    render(<CanvasToolbar {...defaultProps} onFitView={onFitView} />)
    fireEvent.click(screen.getByTitle('Fit View (F)'))
    expect(onFitView).toHaveBeenCalledTimes(1)
  })
})
