import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { DataTable, Column } from '@/components/common/DataTable'

interface TestRow {
  id: string
  name: string
  age: number
  city: string
}

const columns: Column<TestRow>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'age', header: 'Age', sortable: true },
  { key: 'city', header: 'City', sortable: false },
]

const data: TestRow[] = [
  { id: '1', name: 'Alice', age: 30, city: 'London' },
  { id: '2', name: 'Charlie', age: 25, city: 'Paris' },
  { id: '3', name: 'Bob', age: 35, city: 'Berlin' },
]

describe('DataTable', () => {
  it('renders all column headers', () => {
    render(
      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        rowKey="id"
      />
    )
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Age')).toBeInTheDocument()
    expect(screen.getByText('City')).toBeInTheDocument()
  })

  it('renders rows with the correct data', () => {
    render(
      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        rowKey="id"
      />
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
    expect(screen.getByText('London')).toBeInTheDocument()
  })

  it('shows the emptyMessage when data array is empty', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        rowKey="id"
        emptyMessage="No records found"
      />
    )
    expect(screen.getByText('No records found')).toBeInTheDocument()
  })

  it('shows default emptyMessage when not provided', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        rowKey="id"
      />
    )
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('clicking a sortable column sorts ascending then descending then unsorts', () => {
    render(
      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        rowKey="id"
      />
    )
    const nameHeader = screen.getByText('Name').closest('th')!
    // First click: sort ascending (Alice, Bob, Charlie)
    fireEvent.click(nameHeader)
    const rowsAfterAsc = screen.getAllByRole('row').slice(1) // skip header
    expect(rowsAfterAsc[0]).toHaveTextContent('Alice')
    expect(rowsAfterAsc[2]).toHaveTextContent('Charlie')

    // Second click: sort descending
    fireEvent.click(nameHeader)
    const rowsAfterDesc = screen.getAllByRole('row').slice(1)
    expect(rowsAfterDesc[0]).toHaveTextContent('Charlie')

    // Third click: unsort (back to original order)
    fireEvent.click(nameHeader)
    const rowsUnsorted = screen.getAllByRole('row').slice(1)
    expect(rowsUnsorted[0]).toHaveTextContent('Alice')
  })

  it('calls onRowClick when a row is clicked', () => {
    const onRowClick = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        rowKey="id"
        onRowClick={onRowClick}
      />
    )
    fireEvent.click(screen.getByText('Alice'))
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })

  it('highlights the selected row with a background class', () => {
    render(
      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        rowKey="id"
        selectedRowKey="1"
      />
    )
    const aliceRow = screen.getByText('Alice').closest('tr')!
    expect(aliceRow.className).toMatch(/cyan/)
  })

  it('uses the custom render function for columns', () => {
    const customColumns: Column<TestRow>[] = [
      {
        key: 'name',
        header: 'Name',
        render: (row) => <span data-testid="custom">{row.name.toUpperCase()}</span>,
      },
    ]
    render(
      <DataTable
        columns={customColumns}
        data={data as unknown as Record<string, unknown>[]}
        rowKey="id"
      />
    )
    expect(screen.getByText('ALICE')).toBeInTheDocument()
    expect(screen.getByText('BOB')).toBeInTheDocument()
  })

  it('compact mode applies py-1 class to cells', () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        rowKey="id"
        compact
      />
    )
    const cells = container.querySelectorAll('td')
    cells.forEach((cell) => {
      expect(cell).toHaveClass('py-1')
    })
  })

  it('non-compact mode uses py-2 class on cells', () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        rowKey="id"
      />
    )
    const cells = container.querySelectorAll('td')
    cells.forEach((cell) => {
      expect(cell).toHaveClass('py-2')
    })
  })
})
