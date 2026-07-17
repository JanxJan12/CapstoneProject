import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";
import { EmptyState } from "./EmptyState";

export interface DataTableColumn<Row> {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<Row> {
  rows: readonly Row[];
  columns: readonly DataTableColumn<Row>[];
  rowKey: (row: Row) => string;
  label: string;
  emptyTitle: string;
  emptyDescription: string;
  minWidthClassName?: string;
  getRowClassName?: (row: Row) => string | undefined;
  renderExpandedRow?: (row: Row) => ReactNode;
  isRowExpanded?: (row: Row) => boolean;
}

export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  label,
  emptyTitle,
  emptyDescription,
  minWidthClassName,
  getRowClassName,
  renderExpandedRow,
  isRowExpanded,
}: DataTableProps<Row>) {
  if (!rows.length) {
    return (
      <div className="p-4">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className={cn("rrj-table w-full", minWidthClassName)}
        aria-label={label}
      >
        <thead>
          <tr className="border-b border-border bg-gradient-to-r from-[#f7f1ea] to-[#fbf8f4]">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  "px-3 py-3 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground",
                  column.headerClassName,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const key = rowKey(row);
            const expanded = isRowExpanded?.(row) ?? false;
            return (
              <FragmentRow
                key={key}
                row={row}
                columns={columns}
                className={getRowClassName?.(row)}
                expanded={expanded}
                expandedContent={
                  expanded ? renderExpandedRow?.(row) : undefined
                }
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow<Row>({
  row,
  columns,
  className,
  expanded,
  expandedContent,
}: {
  row: Row;
  columns: readonly DataTableColumn<Row>[];
  className?: string;
  expanded: boolean;
  expandedContent?: ReactNode;
}) {
  return (
    <>
      <tr className={cn("hover:bg-muted/20", className)}>
        {columns.map((column) => (
          <td key={column.id} className={cn("px-3 py-3", column.cellClassName)}>
            {column.cell(row)}
          </td>
        ))}
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={columns.length}>{expandedContent}</td>
        </tr>
      ) : null}
    </>
  );
}
