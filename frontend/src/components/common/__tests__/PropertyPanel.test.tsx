import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { PropertyPanel } from '@/components/common/PropertyPanel'

describe('PropertyPanel', () => {
  it('renders with default title "Properties"', () => {
    render(
      <PropertyPanel>
        <p>child</p>
      </PropertyPanel>
    )
    expect(screen.getByText('Properties')).toBeInTheDocument()
  })

  it('renders with a custom title', () => {
    render(
      <PropertyPanel title="Settings">
        <p>child</p>
      </PropertyPanel>
    )
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders children inside the panel', () => {
    render(
      <PropertyPanel>
        <p>Panel child content</p>
      </PropertyPanel>
    )
    expect(screen.getByText('Panel child content')).toBeInTheDocument()
  })

  it('renders PropertyPanel.Row with label and children', () => {
    render(
      <PropertyPanel>
        <PropertyPanel.Row label="Width">
          <span>100px</span>
        </PropertyPanel.Row>
      </PropertyPanel>
    )
    expect(screen.getByText('Width')).toBeInTheDocument()
    expect(screen.getByText('100px')).toBeInTheDocument()
  })

  it('renders PropertyPanel.Section with title and children', () => {
    render(
      <PropertyPanel>
        <PropertyPanel.Section title="Dimensions">
          <p>Section content</p>
        </PropertyPanel.Section>
      </PropertyPanel>
    )
    expect(screen.getByText('Dimensions')).toBeInTheDocument()
    expect(screen.getByText('Section content')).toBeInTheDocument()
  })
})
