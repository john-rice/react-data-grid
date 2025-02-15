import faker from 'faker';
import { useState } from 'react';
import { css } from '@linaria/core';
import DataGrid from '../../src';
import type { Column } from '../../src';

const loadMoreRowsClassname = css`
  width: 180px;
  padding: 8px 16px;
  position: absolute;
  bottom: 8px;
  right: 8px;
  color: white;
  line-height: 35px;
  background: rgb(0 0 0 / 0.6);
`;

interface Row {
  id: string;
  email: string;
  title: string;
  firstName: string;
  lastName: string;
}

function rowKeyGetter(row: Row) {
  return row.id;
}

const columns: readonly Column<Row>[] = [
  {
    key: 'id',
    name: 'ID'
  },
  {
    key: 'title',
    name: 'Title'
  },
  {
    key: 'firstName',
    name: 'First Name'
  },
  {
    key: 'lastName',
    name: 'Last Name'
  },
  {
    key: 'email',
    name: 'Email'
  }
];

function createFakeRowObjectData(index: number): Row {
  return {
    id: `id_${index}`,
    email: faker.internet.email(),
    title: faker.name.prefix(),
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName()
  };
}

function createRows(numberOfRows: number): Row[] {
  const rows: Row[] = [];

  for (let i = 0; i < numberOfRows; i++) {
    rows[i] = createFakeRowObjectData(i);
  }

  return rows;
}

function isAtBottom({ currentTarget }: React.UIEvent<HTMLDivElement>): boolean {
  return currentTarget.scrollTop + 10 >= currentTarget.scrollHeight - currentTarget.clientHeight;
}

function loadMoreRows(newRowsCount: number, length: number): Promise<Row[]> {
  return new Promise((resolve) => {
    const newRows: Row[] = [];

    for (let i = 0; i < newRowsCount; i++) {
      newRows[i] = createFakeRowObjectData(i + length);
    }

    setTimeout(() => resolve(newRows), 1000);
  });
}

export default function InfiniteScrolling() {
  const [rows, setRows] = useState(() => createRows(50));
  const [isLoading, setIsLoading] = useState(false);

  async function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    if (isLoading || !isAtBottom(event)) return;

    setIsLoading(true);

    const newRows = await loadMoreRows(50, rows.length);

    setRows([...rows, ...newRows]);
    setIsLoading(false);
  }

  return (
    <>
      <DataGrid
        columns={columns}
        rows={rows}
        rowKeyGetter={rowKeyGetter}
        onRowsChange={setRows}
        rowHeight={30}
        onScroll={handleScroll}
        className="fill-grid"
      />
      {isLoading && <div className={loadMoreRowsClassname}>Loading more rows...</div>}
    </>
  );
}
