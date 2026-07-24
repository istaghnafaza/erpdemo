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
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import {
  ORDER_FULFILLMENT_LABELS,
  PAYMENT_METHOD_LABELS,
  TX_STATUS_LABELS,
  orderFulfillmentLabel,
  paymentMethodLabel,
} from "@/lib/sales-transaction-utils";
import { tanggal } from "@/lib/format";
import { computeTransactionMargin } from "@/lib/sales-margin";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/types/app";
import type { OrderFulfillmentType, SalesTransactionRecord } from "@/types/sales-transactions";
import { Receipt } from "lucide-react";

interface SalesTransactionDataTableProps {
  data: SalesTransactionRecord[];
  isConsolidated: boolean;
  onRowClick: (row: SalesTransactionRecord) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];

export function SalesTransactionDataTable({
  data,
  isConsolidated,
  onRowClick,
}: SalesTransactionDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<SalesTransactionRecord>[]>(
    () => [
      {
        accessorKey: "transactionNumber",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            No. Transaksi
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.transactionNumber}</span>
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
              cell: ({ row }: { row: { original: SalesTransactionRecord } }) => (
                <span className="text-sm">{row.original.branchName}</span>
              ),
            } satisfies ColumnDef<SalesTransactionRecord>,
          ]
        : []),
      {
        accessorKey: "cashierName",
        header: "Kasir",
        filterFn: "includesString",
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => row.original.customerName ?? "—",
        filterFn: "includesString",
      },
      {
        accessorKey: "itemCount",
        header: () => <span className="block text-center">Item</span>,
        cell: ({ row }) => <span className="block text-center">{row.original.itemCount}</span>,
      },
      {
        accessorKey: "paymentMethod",
        header: "Bayar",
        filterFn: "equals",
        cell: ({ row }) => paymentMethodLabel(row.original.paymentMethod),
      },
      {
        accessorKey: "orderFulfillmentType",
        header: "Order",
        filterFn: "equals",
        cell: ({ row }) =>
          orderFulfillmentLabel(row.original.orderFulfillmentType ?? "cod"),
      },
      {
        id: "margin",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 float-right"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Keuntungan
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        ),
        accessorFn: (row) => computeTransactionMargin(row),
        cell: ({ row }) => {
          const margin = computeTransactionMargin(row.original);
          return (
            <div className="text-right text-info">
              <CurrencyDisplay value={margin} />
            </div>
          );
        },
      },
      {
        accessorKey: "grandTotal",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 float-right"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Total
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-semibold">
            <CurrencyDisplay value={row.original.grandTotal} />
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        filterFn: "equals",
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge
              variant="secondary"
              className={cn(
                "border-0",
                status === "voided"
                  ? "bg-destructive/15 text-destructive"
                  : status === "returned"
                    ? "bg-warning/15 text-warning-foreground"
                    : "bg-success/15 text-success",
              )}
            >
              {TX_STATUS_LABELS[status]}
            </Badge>
          );
        },
      },
      {
        accessorKey: "isOffline",
        header: () => <span className="sr-only">Offline</span>,
        cell: ({ row }) =>
          row.original.isOffline ? (
            <Badge variant="outline" className="text-[10px]">
              Offline
            </Badge>
          ) : null,
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
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue).toLowerCase();
      if (!q) return true;
      const t = row.original;
      return (
        t.transactionNumber.toLowerCase().includes(q) ||
        t.cashierName.toLowerCase().includes(q) ||
        (t.customerName?.toLowerCase().includes(q) ?? false) ||
        t.branchName.toLowerCase().includes(q)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const paymentFilter =
    (columnFilters.find((f) => f.id === "paymentMethod")?.value as string) ?? "all";
  const statusFilter =
    (columnFilters.find((f) => f.id === "status")?.value as string) ?? "all";
  const branchFilter =
    (columnFilters.find((f) => f.id === "branchName")?.value as string) ?? "all";
  const cashierFilter =
    (columnFilters.find((f) => f.id === "cashierName")?.value as string) ?? "";
  const orderFilter =
    (columnFilters.find((f) => f.id === "orderFulfillmentType")?.value as string) ?? "all";

  const branchOptions = useMemo(
    () => Array.from(new Set(data.map((d) => d.branchName))).sort(),
    [data],
  );

  const cashierOptions = useMemo(
    () => Array.from(new Set(data.map((d) => d.cashierName))).sort(),
    [data],
  );

  const filteredRows = table.getFilteredRowModel().rows;
  const footerTotals = useMemo(() => {
    const completed = filteredRows
      .map((r) => r.original)
      .filter((t) => t.status === "completed");
    const totalRevenue = completed.reduce((s, t) => s + t.grandTotal, 0);
    const totalMargin = completed.reduce((s, t) => s + computeTransactionMargin(t), 0);
    const marginPct = totalRevenue > 0 ? Math.round((totalMargin / totalRevenue) * 100) : 0;
    return { totalRevenue, totalMargin, marginPct, count: filteredRows.length };
  }, [filteredRows]);

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Belum ada transaksi penjualan"
        description="Transaksi dari POS akan muncul di sini secara otomatis."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari no. transaksi, kasir, customer..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={paymentFilter}
          onValueChange={(v) =>
            setColumnFilters((prev) => {
              const rest = prev.filter((f) => f.id !== "paymentMethod");
              return v === "all" ? rest : [...rest, { id: "paymentMethod", value: v }];
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Metode bayar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua metode</SelectItem>
            {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>

        <Select
          value={orderFilter}
          onValueChange={(v) =>
            setColumnFilters((prev) => {
              const rest = prev.filter((f) => f.id !== "orderFulfillmentType");
              return v === "all" ? rest : [...rest, { id: "orderFulfillmentType", value: v }];
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="Keterangan order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua order</SelectItem>
            {(Object.entries(ORDER_FULFILLMENT_LABELS) as [OrderFulfillmentType, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setColumnFilters((prev) => {
              const rest = prev.filter((f) => f.id !== "status");
              return v === "all" ? rest : [...rest, { id: "status", value: v }];
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="completed">Selesai</SelectItem>
            <SelectItem value="voided">Void</SelectItem>
            <SelectItem value="returned">Retur</SelectItem>
          </SelectContent>
        </Select>

        {isConsolidated && (
          <Select
            value={branchFilter}
            onValueChange={(v) =>
              setColumnFilters((prev) => {
                const rest = prev.filter((f) => f.id !== "branchName");
                return v === "all" ? rest : [...rest, { id: "branchName", value: v }];
              })
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Cabang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua cabang</SelectItem>
              {branchOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={cashierFilter || "all"}
          onValueChange={(v) =>
            setColumnFilters((prev) => {
              const rest = prev.filter((f) => f.id !== "cashierName");
              return v === "all" ? rest : [...rest, { id: "cashierName", value: v }];
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Kasir" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kasir</SelectItem>
            {cashierOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/40">
                  {headerGroup.headers.map((header) => (
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
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    Tidak ada transaksi yang cocok dengan filter.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => onRowClick(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
            {filteredRows.length > 0 && (
              <tfoot>
                <TableRow className="bg-muted/30 font-semibold border-t">
                  <TableCell
                    colSpan={isConsolidated ? 8 : 7}
                    className="text-right text-muted-foreground"
                  >
                    Total ({footerTotals.count} transaksi)
                  </TableCell>
                  <TableCell className="text-right text-info">
                    <CurrencyDisplay value={footerTotals.totalMargin} />
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      Margin {footerTotals.marginPct}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={footerTotals.totalRevenue} />
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </tfoot>
            )}
          </Table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="text-muted-foreground">
          Menampilkan {table.getFilteredRowModel().rows.length} transaksi
          {table.getPageCount() > 1 &&
            ` · Halaman ${table.getState().pagination.pageIndex + 1} dari ${table.getPageCount()}`}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
