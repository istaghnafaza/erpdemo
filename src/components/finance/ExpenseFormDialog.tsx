import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CashAccount } from "@/types/database";

interface ExpenseFormDialogProps {
  open: boolean;
  onClose: () => void;
  accounts: CashAccount[];
  categories: readonly string[];
  loading: boolean;
  onSubmit: (data: {
    cash_account_id: string;
    category: string;
    amount: number;
    description: string | null;
    reference: string | null;
  }) => Promise<{ success: boolean; error?: string }>;
}

const nativeSelectClass = cn(
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function ExpenseFormDialog({
  open,
  onClose,
  accounts,
  categories,
  loading,
  onSubmit,
}: ExpenseFormDialogProps) {
  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.is_active !== false),
    [accounts],
  );

  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState<string>(categories[0] ?? "Operasional");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wasOpenRef = useRef(false);

  // Reset form hanya saat dialog baru dibuka — bukan setiap re-render.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setAccountId(activeAccounts[0]?.id ?? "");
      setCategory(categories[0] ?? "Operasional");
      setAmount("");
      setDescription("");
      setReference("");
      setError(null);
    }
    wasOpenRef.current = open;
  }, [open, activeAccounts, categories]);

  // Jika akun belum terpilih setelah data cabang tersedia.
  useEffect(() => {
    if (!open || accountId || activeAccounts.length === 0) return;
    setAccountId(activeAccounts[0].id);
  }, [open, accountId, activeAccounts]);

  const selectedAccount = activeAccounts.find((a) => a.id === accountId);

  const handleSubmit = async () => {
    const num = Number(amount);
    if (!num || num <= 0) {
      setError("Nominal harus lebih dari 0");
      return;
    }
    if (!accountId) {
      setError("Pilih akun kas/bank");
      return;
    }

    setError(null);
    const result = await onSubmit({
      cash_account_id: accountId,
      category,
      amount: num,
      description: description.trim() || null,
      reference: reference.trim() || null,
    });
    if (!result.success) setError(result.error ?? "Gagal mencatat pengeluaran");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Catat Pengeluaran</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="expense-account">Akun Kas/Bank *</Label>
            {activeAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-md border p-3">
                Belum ada akun kas/bank untuk cabang ini.
              </p>
            ) : (
              <select
                id="expense-account"
                className={nativeSelectClass}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {rupiah(a.balance, { compact: true })}
                  </option>
                ))}
              </select>
            )}
            {selectedAccount && (
              <p className="text-xs text-muted-foreground">
                Saldo tersedia: <CurrencyDisplay value={selectedAccount.balance} />
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-category">Kategori *</Label>
            <select
              id="expense-category"
              className={nativeSelectClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-amount">Nominal (Rp) *</Label>
            <Input
              id="expense-amount"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={amount ? Number(amount).toLocaleString("id-ID") : ""}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-description">Deskripsi</Label>
            <Textarea
              id="expense-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Contoh: Bayar listrik PLN"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-reference">Referensi (opsional)</Label>
            <Input
              id="expense-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="No. invoice / bukti"
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={loading || activeAccounts.length === 0}
            onClick={() => void handleSubmit()}
          >
            {loading ? "Menyimpan..." : "Simpan Pengeluaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
