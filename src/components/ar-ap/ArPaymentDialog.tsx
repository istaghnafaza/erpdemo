import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { rupiah } from "@/lib/format";
import { remainingAmount } from "@/lib/ar-ap-utils";
import type { Receivable } from "@/lib/mock-data";
import type { CashAccount } from "@/types/database";
import type { RecordArPaymentDraft } from "@/stores/receivables.store";

interface ArPaymentDialogProps {
  open: boolean;
  receivable: Receivable | null;
  cashAccounts: CashAccount[];
  userId: string;
  onClose: () => void;
  onSubmit: (draft: RecordArPaymentDraft) => { ok: boolean; error?: string };
  onSuccess?: () => void;
}

export function ArPaymentDialog({
  open,
  receivable,
  cashAccounts,
  userId,
  onClose,
  onSubmit,
  onSuccess,
}: ArPaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");

  const branchAccounts = useMemo(
    () => cashAccounts.filter((a) => a.branch_id === receivable?.branchId && a.is_active),
    [cashAccounts, receivable?.branchId],
  );

  useEffect(() => {
    if (!receivable) return;
    setAmount(String(remainingAmount(receivable.amount, receivable.paid)));
    setCashAccountId(branchAccounts[0]?.id ?? "");
  }, [receivable, branchAccounts]);

  const remaining = receivable ? remainingAmount(receivable.amount, receivable.paid) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Catat Pembayaran Piutang</DialogTitle>
        </DialogHeader>
        {receivable && (
          <div className="space-y-3">
            <div className="bg-muted rounded-lg p-3 text-sm">
              <div className="text-muted-foreground text-xs">Invoice</div>
              <div className="font-mono font-semibold">{receivable.invoice}</div>
              <div className="text-muted-foreground text-xs mt-2">Sisa Tagihan</div>
              <div className="text-lg font-bold text-primary">
                <CurrencyDisplay value={remaining} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Akun Kas/Bank Penerima</Label>
              <Select value={cashAccountId} onValueChange={setCashAccountId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih akun" />
                </SelectTrigger>
                <SelectContent>
                  {branchAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — {rupiah(a.balance, { compact: true })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Jumlah Bayar (Rp)</Label>
              <Input
                value={amount ? Number(amount).toLocaleString("id-ID") : ""}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                className="text-lg h-11 mt-1"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            className="bg-gradient-primary"
            disabled={!receivable || !cashAccountId}
            onClick={() => {
              if (!receivable) return;
              const result = onSubmit({
                receivable_id: receivable.id,
                cash_account_id: cashAccountId,
                amount: Number(amount),
                user_id: userId,
              });
              if (result.ok) {
                onSuccess?.();
                onClose();
              }
            }}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Simpan Pembayaran
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
