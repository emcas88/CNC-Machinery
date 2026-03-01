import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { Modal } from '@/components/common/Modal'

describe('Modal', () => {
  it('does not render content when open=false', () => {
    render(
      <Modal open={false} onClose={vi.fn()}>
        <p>Hidden Content</p>
      </Modal>
    )
    expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument()
  })

  it('renders children when open=true', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <p>Visible Content</p>
      </Modal>
    )
    expect(screen.getByText('Visible Content')).toBeInTheDocument()
  })

  it('renders the title when provided', () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="My Modal Title">
        <p>Content</p>
      </Modal>
    )
    expect(screen.getByText('My Modal Title')).toBeInTheDocument()
  })

  it('does not render a title element when title is omitted', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <p>Content</p>
      </Modal>
    )
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('calls onClose when the X button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose} title="Closeable">
        <p>Content</p>
      </Modal>
    )
    const closeBtn = screen.getByRole('button')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders footer content when footer prop is provided', () => {
    render(
      <Modal open={true} onClose={vi.fn()} footer={<button>Save</button>}>
        <p>Content</p>
      </Modal>
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('does not render a footer when footer prop is omitted', () => {
    const { container } = render(
      <Modal open={true} onClose={vi.fn()}>
        <p>Content</p>
      </Modal>
    )
    const footerDiv = container.querySelector('.border-t.border-gray-700')
    expect(footerDiv).not.toBeInTheDocument()
  })
})
