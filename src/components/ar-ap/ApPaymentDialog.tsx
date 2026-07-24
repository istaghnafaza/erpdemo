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
import type { Payable } from "@/lib/mock-data";
import type { CashAccount } from "@/types/database";
import type { RecordApPaymentDraft } from "@/stores/payables.store";

interface ApPaymentDialogProps {
  open: boolean;
  payable: Payable | null;
  cashAccounts: CashAccount[];
  userId: string;
  onClose: () => void;
  onSubmit: (draft: RecordApPaymentDraft) => { ok: boolean; error?: string };
  onSuccess?: () => void;
}

export function ApPaymentDialog({
  open,
  payable,
  cashAccounts,
  userId,
  onClose,
  onSubmit,
  onSuccess,
}: ApPaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");

  const branchAccounts = useMemo(
    () => cashAccounts.filter((a) => a.branch_id === payable?.branchId && a.is_active),
    [cashAccounts, payable?.branchId],
  );

  useEffect(() => {
    if (!payable) return;
    setAmount(String(remainingAmount(payable.amount, payable.paid)));
    setCashAccountId(branchAccounts[0]?.id ?? "");
  }, [payable, branchAccounts]);

  const remaining = payable ? remainingAmount(payable.amount, payable.paid) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Catat Pembayaran Hutang</DialogTitle>
        </DialogHeader>
        {payable && (
          <div className="space-y-3">
            <div className="bg-muted rounded-lg p-3 text-sm">
              <div className="text-muted-foreground text-xs">Invoice</div>
              <div className="font-mono font-semibold">{payable.invoice}</div>
              <div className="text-muted-foreground text-xs mt-2">Sisa Hutang</div>
              <div className="text-lg font-bold text-primary">
                <CurrencyDisplay value={remaining} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Bayar Dari Akun Kas/Bank</Label>
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
            disabled={!payable || !cashAccountId}
            onClick={() => {
              if (!payable) return;
              const result = onSubmit({
                payable_id: payable.id,
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
