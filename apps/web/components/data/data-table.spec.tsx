import { render, screen } from '@testing-library/react';

import { DataTable, type DataTableColumn } from './data-table';

type Row = { id: string; name: string; status: string };

const columns: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Name', cell: (row) => row.name },
  { key: 'status', header: 'Status', cell: (row) => row.status },
];

describe('DataTable', () => {
  it('renders rows and pagination controls', () => {
    render(
      <DataTable
        columns={columns}
        rows={[{ id: 'row-1', name: 'Finance Agent', status: 'active' }]}
        pagination={{ total: 25, page: 1, limit: 20, totalPages: 2 }}
        onPageChange={() => undefined}
      />,
    );

    expect(screen.getAllByText('Finance Agent')).toHaveLength(2);
    expect(screen.getByText(/25/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });

  it('renders an empty state', () => {
    render(<DataTable columns={columns} rows={[]} empty="No users" />);

    expect(screen.getByText('No users')).toBeInTheDocument();
  });
});
