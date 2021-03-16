import DataGrid, { HeaderRow, Viewport } from '../../src';
import type { Column } from '../../src';

function EmptyRowsRenderer() {
  return <div style={{ textAlign: 'center' }}>Nothing to show <span lang="ja" title="ショボーン">(´・ω・`)</span></div>;
}

interface Row {
  id: number;
  title: string;
  count: number;
}

const columns: readonly Column<Row>[] = [
  { key: 'id', name: 'ID' },
  { key: 'title', name: 'Title' },
  { key: 'count', name: 'Count' }
];

const rows: readonly Row[] = [];

export function NoRows() {
  return (
    <DataGrid
      columns={columns}
      className="small-grid"
    >
      <HeaderRow />
      <Viewport rows={rows} />
      <EmptyRowsRenderer />
    </DataGrid>
  );
}

NoRows.storyName = 'No Rows';
