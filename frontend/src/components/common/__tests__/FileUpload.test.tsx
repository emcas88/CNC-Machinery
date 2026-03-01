import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { FileUpload } from '@/components/common/FileUpload'

describe('FileUpload', () => {
  it('renders the default label text', () => {
    render(<FileUpload onFiles={vi.fn()} />)
    expect(screen.getByText('Drop files here or click to upload')).toBeInTheDocument()
  })

  it('renders a custom label', () => {
    render(<FileUpload onFiles={vi.fn()} label="Upload your file" />)
    expect(screen.getByText('Upload your file')).toBeInTheDocument()
  })

  it('calls onFiles with selected files when input changes', () => {
    const onFiles = vi.fn()
    render(<FileUpload onFiles={onFiles} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    expect(onFiles).toHaveBeenCalledWith([file])
  })

  it('shows file names after files are dropped', () => {
    const onFiles = vi.fn()
    const { container } = render(<FileUpload onFiles={onFiles} />)
    const label = container.querySelector('label')!
    const file = new File(['content'], 'test.png', { type: 'image/png' })
    fireEvent.drop(label, {
      dataTransfer: { files: [file] },
    })
    expect(screen.getByText('test.png')).toBeInTheDocument()
  })

  it('applies disabled styles when disabled prop is true', () => {
    const { container } = render(<FileUpload onFiles={vi.fn()} disabled />)
    const label = container.querySelector('label')!
    expect(label.className).toMatch(/opacity-50/)
    expect(label.className).toMatch(/pointer-events-none/)
  })

  it('does not call onFiles when no files are selected', () => {
    const onFiles = vi.fn()
    render(<FileUpload onFiles={onFiles} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [] })
    fireEvent.change(input)
    expect(onFiles).not.toHaveBeenCalled()
  })
})
