import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { FloorPlanEditor } from '../FloorPlanEditor'

describe('FloorPlanEditor', () => {
  it('renders page heading', () => {
    render(<FloorPlanEditor />)
    expect(screen.getAllByText('Floor Plan Editor').length).toBeGreaterThan(0)
  })

  it('renders placeholder content', () => {
    render(<FloorPlanEditor />)
    expect(screen.getByText('2D room layout coming soon')).toBeInTheDocument()
  })
})
