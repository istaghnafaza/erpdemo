import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  INVENTORY_BULK_INPUT_THRESHOLD,
  INVENTORY_INPUT_GUIDE,
} from "@/lib/inventory-input-policy";
import {
  parseImportFile,
  parsedRowsToInventoryItems,
  type ParsedImportRow,
} from "@/lib/inventory-import-parser";
import type { ProductCatalogForImport } from "@/lib/inventory-import-template";
import { applyOnboardingInventoryToBranch } from "@/lib/apply-onboarding-inventory";
import { toast } from "sonner";

interface ProductImportDialogProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  branchId: string;
  branchName: string;
  catalog: ProductCatalogForImport;
  existingSkus: string[];
  onImported: () => void;
}

function formatIdr(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function ProductImportDialog({
  open,
  onClose,
  tenantId,
  branchId,
  branchName,
  catalog,
  existingSkus,
  onImported,
}: ProductImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const validRows = rows.filter((r) => r.valid);
  const invalidRows = rows.filter((r) => !r.valid);

  const reset = () => {
    setFileName("");
    setRows([]);
    setParsing(false);
    setImporting(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setParsing(true);
    setFileName(file.name);
    try {
      const parsed = await parseImportFile(file, catalog, existingSkus);
      setRows(parsed);
      if (parsed.length === 0) {
        toast.error("Tidak ada baris data — pastikan file sudah diisi");
      } else {
        const ok = parsed.filter((r) => r.valid).length;
        toast.success(`${ok} baris valid dari ${parsed.length} baris`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membaca file");
      setRows([]);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const items = parsedRowsToInventoryItems(validRows);
      const result = await applyOnboardingInventoryToBranch(tenantId, branchId, items);
      toast.success(`${result.applied} produk diimport ke ${branchName}`);
      onImported();
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import gagal");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Master Barang
          </DialogTitle>
          <DialogDescription>
            {INVENTORY_INPUT_GUIDE.bulk} Cabang tujuan: <strong>{branchName}</strong>.
            Untuk data lama dari buku/Excel toko, gunakan sheet <strong>Data Legacy</strong>{" "}
            {INVENTORY_INPUT_GUIDE.legacy.replace("Sheet Data Legacy — ", "")}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
          <p>
            <strong>&lt; {INVENTORY_BULK_INPUT_THRESHOLD} barang:</strong> {INVENTORY_INPUT_GUIDE.manual}
          </p>
          <p>
            <strong>≥ {INVENTORY_BULK_INPUT_THRESHOLD} barang:</strong> {INVENTORY_INPUT_GUIDE.bulk}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={parsing || importing}
          >
            <Upload className="h-4 w-4 mr-2" />
            {parsing ? "Membaca file..." : "Pilih file Excel/CSV"}
          </Button>
          {fileName ? <span className="text-sm text-muted-foreground">{fileName}</span> : null}
        </div>

        {rows.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {validRows.length} valid
              </Badge>
              {invalidRows.length > 0 ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {invalidRows.length} error
                </Badge>
              ) : null}
              {validRows.length > 0 && validRows.length < INVENTORY_BULK_INPUT_THRESHOLD ? (
                <Badge variant="outline">Boleh juga via Tambah Produk manual</Badge>
              ) : null}
            </div>

            <div className="rounded-md border max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Baris</TableHead>
                    <TableHead>Sheet</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Harga Jual</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((row) => (
                    <TableRow key={`${row.sheetName}-${row.rowIndex}-${row.sku}`}>
                      <TableCell>{row.rowIndex}</TableCell>
                      <TableCell className="max-w-[120px] truncate">{row.sheetName}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{row.name || "—"}</TableCell>
                      <TableCell>{row.sku || "—"}</TableCell>
                      <TableCell>{row.sellPrice ? formatIdr(row.sellPrice) : "—"}</TableCell>
                      <TableCell>
                        {row.valid ? (
                          <span className="text-green-600 text-xs">OK</span>
                        ) : (
                          <span className="text-destructive text-xs">{row.error}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rows.length > 100 ? (
              <p className="text-xs text-muted-foreground">Menampilkan 100 baris pertama dari {rows.length}.</p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={importing}>
            Batal
          </Button>
          <Button
            type="button"
            onClick={() => void handleImport()}
            disabled={importing || validRows.length === 0}
          >
            {importing ? "Mengimport..." : `Import ${validRows.length} produk`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
