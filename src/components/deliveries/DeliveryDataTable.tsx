import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, PackageCheck, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { DeliveryStatusBadge } from "@/components/deliveries/DeliveryStatusBadge";
import { DELIVERY_STATUS_LABELS } from "@/lib/delivery-utils";
import { orderFulfillmentLabel } from "@/lib/sales-transaction-utils";
import { tanggal } from "@/lib/format";
import type { DeliveryRecord, DeliveryStatus } from "@/types/deliveries";

interface DeliveryDataTableProps {
  data: DeliveryRecord[];
  isConsolidated: boolean;
  onRowClick: (row: DeliveryRecord) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];

export function DeliveryDataTable({ data, isConsolidated, onRowClick }: DeliveryDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<DeliveryRecord>[]>(
    () => [
      {
        accessorKey: "deliveryNumber",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            No. DO
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.deliveryNumber}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Tanggal
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {tanggal(row.original.createdAt, { withTime: true })}
          </span>
        ),
        sortingFn: "datetime",
      },
      ...(isConsolidated
        ? [
            {
              accessorKey: "branchName",
              header: "Cabang",
              filterFn: "includesString",
              cell: ({ row }: { row: { original: DeliveryRecord } }) => (
                <span className="text-sm">{row.original.branchName}</span>
              ),
            } satisfies ColumnDef<DeliveryRecord>,
          ]
        : []),
      {
        accessorKey: "customerName",
        header: "Pelanggan",
        cell: ({ row }) => row.original.customerName ?? "—",
      },
      {
        accessorKey: "orderFulfillmentType",
        header: "Tipe Order",
        cell: ({ row }) => orderFulfillmentLabel(row.original.orderFulfillmentType),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <DeliveryStatusBadge status={row.original.status} />,
        filterFn: (row, _id, value) => !value || row.original.status === value,
      },
      {
        accessorKey: "driverName",
        header: "Driver",
        cell: ({ row }) => row.original.driverName ?? "—",
      },
      {
        accessorKey: "scheduledDate",
        header: "Jadwal",
        cell: ({ row }) =>
          row.original.scheduledDate
            ? tanggal(row.original.scheduledDate, { withTime: false })
            : "—",
      },
      {
        accessorKey: "grandTotal",
        header: "Total",
        cell: ({ row }) => <CurrencyDisplay amount={row.original.grandTotal} />,
      },
    ],
    [isConsolidated],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue).toLowerCase();
      if (!q) return true;
      const d = row.original;
      return (
        d.deliveryNumber.toLowerCase().includes(q) ||
        d.transactionNumber.toLowerCase().includes(q) ||
        (d.customerName?.toLowerCase().includes(q) ?? false) ||
        (d.driverName?.toLowerCase().includes(q) ?? false) ||
        (d.deliveryAddress?.toLowerCase().includes(q) ?? false)
      );
    },
    initialState: { pagination: { pageSize: 20 } },
  });

  if (data.length === 0) {
    return (
      <EmptyState
        icon={PackageCheck}
        title="Belum ada pengiriman"
        description="Data pengiriman dibuat otomatis saat checkout POS dengan keterangan order Di Kirim atau Di Kirim Sebagian."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari no. DO, transaksi, pelanggan..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={(table.getColumn("status")?.getFilterValue() as string) ?? "all"}
          onValueChange={(v) =>
            table.getColumn("status")?.setFilterValue(v === "all" ? undefined : v)
          }
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {(Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {DELIVERY_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Tidak ada baris yang cocok dengan filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>
          {table.getFilteredRowModel().rows.length} baris
          {globalFilter || columnFilters.length ? " (difilter)" : ""}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(v) => table.setPageSize(Number(v))}
          >
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / hal
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
