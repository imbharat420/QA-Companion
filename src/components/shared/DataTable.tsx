"use client";

import { memo, useCallback, useMemo, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  id: string;
  header: string;
  /** A CSS grid track — "160px", "2fr", "minmax(0,1fr)". Defaults to 1fr. */
  width?: string;
  align?: "left" | "right" | "center";
  cell: (row: T) => ReactNode;
  /** Present = sortable. The table sorts by it; the parent owns the state. */
  sortValue?: (row: T) => string | number;
  className?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  testId: string;
  virtualize?: boolean;
  rowHeight?: number;
  stickyHeader?: boolean;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSortChange?: (id: string) => void;
  selectedKey?: string;
}

/** Above this, a plain render costs more than the virtualiser does. */
const VIRTUALIZE_ABOVE = 100;
const ALIGN: Record<"left" | "right" | "center", string> = {
  left: "justify-start text-left",
  right: "justify-end text-right",
  center: "justify-center text-center",
};

/* ==========================================================================
   ROW
   Its own memoized component, taking primitives and stable callbacks, so a
   1 000-row table re-renders one row when one row's data changes.
   ======================================================================== */

interface DataTableRowProps<T> {
  row: T;
  id: string;
  columns: Column<T>[];
  gridTemplate: string;
  rowHeight: number;
  selected: boolean;
  clickable: boolean;
  onActivate?: (row: T) => void;
  /** Set only while virtualised — absolute placement inside the spacer. */
  offsetY?: number;
  testId: string;
}

function DataTableRowImpl<T>({
  row,
  id,
  columns,
  gridTemplate,
  rowHeight,
  selected,
  clickable,
  onActivate,
  offsetY,
  testId,
}: DataTableRowProps<T>) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!clickable || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onActivate?.(row);
  };

  return (
    <div
      role="row"
      aria-selected={clickable ? selected : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onActivate?.(row) : undefined}
      onKeyDown={onKeyDown}
      data-testid={`${testId}-row-${id}`}
      data-selected={selected || undefined}
      className={cn(
        "grid items-center border-b border-border/40 transition-colors duration-100",
        clickable && "cursor-pointer hover:bg-muted/40",
        selected && "bg-secondary/60",
        offsetY !== undefined && "absolute left-0 top-0 w-full",
      )}
      style={{
        gridTemplateColumns: gridTemplate,
        height: rowHeight,
        transform: offsetY === undefined ? undefined : `translateY(${offsetY}px)`,
      }}
    >
      {columns.map((column) => (
        <div
          key={column.id}
          role="gridcell"
          className={cn(
            "flex min-w-0 items-center gap-1.5 px-3 text-xs",
            ALIGN[column.align ?? "left"],
            column.className,
          )}
        >
          {column.cell(row)}
        </div>
      ))}
    </div>
  );
}

// memo() erases the type parameter; one cast restores it instead of widening
// every row in the app to `unknown`.
const DataTableRow = memo(DataTableRowImpl) as typeof DataTableRowImpl;

/* ==========================================================================
   TABLE
   ======================================================================== */

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  empty,
  testId,
  virtualize = false,
  rowHeight = 40,
  stickyHeader = false,
  sortBy,
  sortDir = "asc",
  onSortChange,
  selectedKey,
}: DataTableProps<T>) {
  const scroller = useRef<HTMLDivElement | null>(null);

  const gridTemplate = useMemo(
    () => columns.map((column) => column.width ?? "minmax(0,1fr)").join(" "),
    [columns],
  );

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.id === sortBy);
    if (!column?.sortValue) return rows;
    const read = column.sortValue;
    const factor = sortDir === "desc" ? -1 : 1;
    // Copy: the caller's array is often a query result that must not be mutated.
    return rows.slice().sort((a, b) => {
      const left = read(a);
      const right = read(b);
      if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [columns, rows, sortBy, sortDir]);

  const virtualizing = virtualize || sorted.length > VIRTUALIZE_ABOVE;

  const virtualizer = useVirtualizer({
    // Zero when we render plainly, so the hook stays mounted (hooks cannot be
    // conditional) without measuring anything.
    count: virtualizing ? sorted.length : 0,
    getScrollElement: () => scroller.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  const onActivate = useCallback((row: T) => onRowClick?.(row), [onRowClick]);

  const header = (
    <div
      role="row"
      className="grid items-center border-b border-border bg-elevated"
      style={{ gridTemplateColumns: gridTemplate, height: 32 }}
    >
      {columns.map((column) => {
        const sortable = Boolean(column.sortValue && onSortChange);
        const active = sortBy === column.id;
        const SortIcon = !active ? ChevronsUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;

        return (
          <div
            key={column.id}
            role="columnheader"
            aria-sort={
              !sortable ? undefined : active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
            }
            className={cn("flex min-w-0 items-center px-3", ALIGN[column.align ?? "left"])}
          >
            {sortable ? (
              <button
                type="button"
                onClick={() => onSortChange?.(column.id)}
                data-testid={`${testId}-sort-${column.id}`}
                className={cn(
                  "label-mono flex items-center gap-1 truncate rounded transition-colors hover:text-foreground",
                  active && "text-foreground",
                )}
              >
                <span className="truncate">{column.header}</span>
                <SortIcon className="size-3 shrink-0" aria-hidden />
              </button>
            ) : (
              <span className="label-mono truncate">{column.header}</span>
            )}
          </div>
        );
      })}
    </div>
  );

  if (sorted.length === 0) {
    return (
      <div
        data-testid={testId}
        className="overflow-hidden rounded-[var(--radius-lg)] border border-border/70 bg-card"
      >
        <div role="grid" aria-rowcount={1} className="w-full">
          {header}
        </div>
        {empty ?? (
          <EmptyState
            title="Nothing to show"
            description="No rows match the current filters."
            testId={`${testId}-empty`}
          />
        )}
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      // The table owns its horizontal scroll so a wide column set never makes
      // the page scroll sideways. A sticky header needs a scroll container to
      // stick inside, so it implies a bounded, internally scrolling body.
      ref={scroller}
      className={cn(
        "w-full overflow-x-auto rounded-[var(--radius-lg)] border border-border/70 bg-card",
        (virtualizing || stickyHeader) && "max-h-[70vh] overflow-y-auto",
      )}
    >
      <div role="grid" aria-rowcount={sorted.length + 1} className="w-full">
        <div
          role="rowgroup"
          // Solid bg + a z-index above the rows, or rows bleed through on scroll.
          className={cn(stickyHeader && "sticky top-0 z-20 border-b border-border bg-elevated")}
        >
          {header}
        </div>

        <div
          role="rowgroup"
          className="relative"
          style={virtualizing ? { height: virtualizer.getTotalSize() } : undefined}
        >
          {virtualizing
            ? virtualizer.getVirtualItems().map((item) => {
                const row = sorted[item.index];
                const id = rowKey(row);
                return (
                  <DataTableRow
                    key={id}
                    row={row}
                    id={id}
                    columns={columns}
                    gridTemplate={gridTemplate}
                    rowHeight={item.size}
                    selected={id === selectedKey}
                    clickable={Boolean(onRowClick)}
                    onActivate={onActivate}
                    offsetY={item.start}
                    testId={testId}
                  />
                );
              })
            : sorted.map((row) => {
                const id = rowKey(row);
                return (
                  <DataTableRow
                    key={id}
                    row={row}
                    id={id}
                    columns={columns}
                    gridTemplate={gridTemplate}
                    rowHeight={rowHeight}
                    selected={id === selectedKey}
                    clickable={Boolean(onRowClick)}
                    onActivate={onActivate}
                    testId={testId}
                  />
                );
              })}
        </div>
      </div>
    </div>
  );
}
