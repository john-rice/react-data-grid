import { useMemo } from 'react';
import type { GroupRow, GroupByDictionary, RowHeightArgs } from '../types';

const RENDER_BACTCH_SIZE = 8;

interface ViewportRowsArgs<R> {
  rawRows: readonly R[];
  rowHeight: number | ((args: RowHeightArgs<R>) => number);
  clientHeight: number;
  scrollTop: number;
  groupBy: readonly string[];
  rowGrouper?: (rows: readonly R[], columnKey: string) => Record<string, readonly R[]>;
  expandedGroupIds?: ReadonlySet<unknown>;
  enableVirtualization: boolean;
}

// https://github.com/microsoft/TypeScript/issues/41808
function isReadonlyArray(arr: unknown): arr is readonly unknown[] {
  return Array.isArray(arr);
}

export function useViewportRows<R>({
  rawRows,
  rowHeight,
  clientHeight,
  scrollTop,
  groupBy,
  rowGrouper,
  expandedGroupIds,
  enableVirtualization
}: ViewportRowsArgs<R>) {
  const [groupedRows, rowsCount] = useMemo(() => {
    if (groupBy.length === 0 || !rowGrouper) return [undefined, rawRows.length];

    const groupRows = (rows: readonly R[], [groupByKey, ...remainingGroupByKeys]: readonly string[], startRowIndex: number): [GroupByDictionary<R>, number] => {
      let groupRowsCount = 0;
      const groups: GroupByDictionary<R> = {};
      for (const [key, childRows] of Object.entries(rowGrouper(rows, groupByKey))) {
        // Recursively group each parent group
        const [childGroups, childRowsCount] = remainingGroupByKeys.length === 0
          ? [childRows, childRows.length]
          : groupRows(childRows, remainingGroupByKeys, startRowIndex + groupRowsCount + 1); // 1 for parent row
        groups[key] = { childRows, childGroups, startRowIndex: startRowIndex + groupRowsCount };
        groupRowsCount += childRowsCount + 1; // 1 for parent row
      }

      return [groups, groupRowsCount];
    };

    return groupRows(rawRows, groupBy, 0);
  }, [groupBy, rowGrouper, rawRows]);

  const [rows, isGroupRow] = useMemo(() => {
    const allGroupRows = new Set<unknown>();
    if (!groupedRows) return [rawRows, isGroupRow];

    const flattenedRows: Array<R | GroupRow<R>> = [];
    const expandGroup = (rows: GroupByDictionary<R> | readonly R[], parentId: string | undefined, level: number): void => {
      if (isReadonlyArray(rows)) {
        flattenedRows.push(...rows);
        return;
      }
      Object.keys(rows).forEach((groupKey, posInSet, keys) => {
        // TODO: should users have control over the generated key?
        const id = parentId !== undefined ? `${parentId}__${groupKey}` : groupKey;
        const isExpanded = expandedGroupIds?.has(id) ?? false;
        const { childRows, childGroups, startRowIndex } = rows[groupKey];

        const groupRow: GroupRow<R> = {
          id,
          parentId,
          groupKey,
          isExpanded,
          childRows,
          level,
          posInSet,
          startRowIndex,
          setSize: keys.length
        };
        flattenedRows.push(groupRow);
        allGroupRows.add(groupRow);

        if (isExpanded) {
          expandGroup(childGroups, id, level + 1);
        }
      });
    };

    expandGroup(groupedRows, undefined, 0);
    return [flattenedRows, isGroupRow];

    function isGroupRow(row: R | GroupRow<R>): row is GroupRow<R> {
      return allGroupRows.has(row);
    }
  }, [expandedGroupIds, groupedRows, rawRows]);

  const { getRowTop, getRowHeight, totalRowHeight, rowPositions } = useMemo(() => {
    if (typeof rowHeight === 'number') {
      const getRowTop = (rowIdx: number) => rowIdx * rowHeight;
      const getRowHeight = () => rowHeight;
      return { getRowTop, getRowHeight, totalRowHeight: rowHeight * rows.length, rowPositions: [] };
    }

    const rowPositions: ({ height: number; top: number })[] = [];
    let totalRowHeight = 0;
    // Calcule the height of all the rows upfront. This can cause performance issues
    // and we can consider using a similar approach as react-window
    // https://github.com/bvaughn/react-window/blob/master/src/VariableSizeList.js#L68
    rows.forEach((row: R | GroupRow<R>) => {
      const currentRowHeight = isGroupRow(row)
        ? rowHeight({ type: 'GROUP', row })
        : rowHeight({ type: 'ROW', row });
      rowPositions.push({ top: totalRowHeight, height: currentRowHeight });
      totalRowHeight += currentRowHeight;
    });

    const getRowTop = (rowIdx: number): number => {
      if (rowIdx < 0) {
        rowIdx = 0;
      } else if (rowIdx >= rows.length) {
        rowIdx = rows.length - 1;
      }
      return rowPositions[rowIdx].top;
    };

    const getRowHeight = (rowIdx: number): number => rowPositions[rowIdx].height;

    return { getRowTop, getRowHeight, totalRowHeight, rowPositions };
  }, [isGroupRow, rowHeight, rows]);

  if (!enableVirtualization) {
    return {
      rowOverscanStartIdx: 0,
      rowOverscanEndIdx: rows.length - 1,
      rows,
      rowsCount,
      totalRowHeight,
      isGroupRow,
      getRowTop,
      getRowHeight
    };
  }

  const overscanThreshold = 4;
  const rowVisibleStartIdx = findRowIdx(scrollTop);
  const rowVisibleEndIdx = Math.min(rows.length - 1, findRowIdx(scrollTop + clientHeight));
  const rowOverscanStartIdx = Math.max(0, Math.floor((rowVisibleStartIdx - overscanThreshold) / RENDER_BACTCH_SIZE) * RENDER_BACTCH_SIZE);
  const rowOverscanEndIdx = Math.min(rows.length - 1, Math.ceil((rowVisibleEndIdx + overscanThreshold) / RENDER_BACTCH_SIZE) * RENDER_BACTCH_SIZE);

  return {
    rowOverscanStartIdx,
    rowOverscanEndIdx,
    rows,
    rowsCount,
    totalRowHeight,
    isGroupRow,
    getRowTop,
    getRowHeight
  };

  function findRowIdx(offset: number): number {
    if (typeof rowHeight === 'number') {
      return Math.floor(offset / rowHeight);
    }
    let start = 0;
    let end = rowPositions.length - 1;
    while (start <= end) {
      const middle = start + Math.floor((end - start) / 2);
      const currentOffset = rowPositions[middle].top;

      if (currentOffset === offset) return middle;

      if (currentOffset < offset) {
        start = middle + 1;
      } else if (currentOffset > offset) {
        end = middle - 1;
      }

      if (start > end) return end;
    }
    return 0;
  }
}
