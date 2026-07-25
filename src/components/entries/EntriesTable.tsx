import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import type { Entry } from "@/types";
import { SECTION_LABELS, MONTH_NAMES } from "@/lib/categories";
import { formatMoney, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const columnHelper = createColumnHelper<Entry>();

interface Props {
  entries: Entry[];
  onEdit: (e: Entry) => void;
  onDelete: (e: Entry) => void;
  decimals?: number;
}

export function EntriesTable({ entries, onEdit, onDelete, decimals = 2 }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("date", {
        header: "Date",
        cell: (info) => (
          <span className="whitespace-nowrap">{formatDate(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("month", {
        header: "Month",
        cell: (info) => MONTH_NAMES[info.getValue() - 1],
      }),
      columnHelper.accessor("section", {
        header: "Type",
        cell: (info) => {
          const s = info.getValue();
          return (
            <Badge
              variant={s === "income" ? "success" : s === "cos" ? "warning" : "secondary"}
            >
              {SECTION_LABELS[s]}
            </Badge>
          );
        },
      }),
      columnHelper.accessor("category", {
        header: "Category",
        cell: (info) => <span className="text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor("description", {
        header: "Description",
        cell: (info) => (
          <span className="block max-w-[220px] truncate text-xs text-muted-foreground">
            {info.getValue() || "—"}
          </span>
        ),
      }),
      columnHelper.accessor("amount", {
        header: "Net",
        cell: (info) => {
          const breakdown = info.row.original.breakdown;
          return (
            <span
              className="block text-right font-medium tabular-nums"
              title={breakdown ? `Receipts: ${breakdown}` : undefined}
            >
              {formatMoney(info.getValue(), decimals)}
              {breakdown && <span className="ml-0.5 text-primary">*</span>}
            </span>
          );
        },
      }),
      columnHelper.accessor("vat", {
        header: "VAT (12%)",
        cell: (info) => (
          <span className="block text-right tabular-nums text-muted-foreground">
            {formatMoney(info.getValue() ?? 0, decimals)}
          </span>
        ),
      }),
      columnHelper.display({
        id: "total",
        header: "Total",
        cell: (info) => {
          const r = info.row.original;
          return (
            <span className="block text-right font-medium tabular-nums">
              {formatMoney((r.amount ?? 0) + (r.vat ?? 0), decimals)}
            </span>
          );
        },
      }),
      columnHelper.accessor("account", {
        header: "Customer",
        cell: (info) => (
          <span className="block max-w-[140px] truncate text-xs">
            {info.getValue() || "—"}
          </span>
        ),
      }),
      columnHelper.accessor("paymentMode", {
        header: "Payment",
        cell: (info) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {info.getValue() || "—"}
          </span>
        ),
      }),
      columnHelper.accessor("supplier", {
        header: "Supplier",
        cell: (info) => (
          <span className="block max-w-[140px] truncate text-xs text-muted-foreground">
            {info.getValue() || "—"}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(info.row.original)}
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(info.row.original)}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    [onEdit, onDelete, decimals]
  );

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 12 } },
  });

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                No entries for this period yet. Add your first transaction on the left.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
