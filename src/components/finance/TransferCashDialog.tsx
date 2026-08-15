import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rupiah } from "@/lib/format";
import type { CashAccount } from "@/types/database";

interface TransferCashDialogProps {
  open: boolean;
  onClose: () => void;
  accounts: CashAccount[];
  loading: boolean;
  onSubmit: (data: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description: string | null;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function TransferCashDialog({
  open,
  onClose,
  accounts,
  loading,
  onSubmit,
}: TransferCashDialogProps) {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setFromId(accounts[0]?.id ?? "");
    setToId(accounts[1]?.id ?? "");
    setAmount("");
    setDescription("");
  }, [open, accounts]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pindah Kas / Bank</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Dari akun</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pilih akun sumber" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} — {rupiah(a.balance, { compact: true })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ke akun</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pilih akun tujuan" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} disabled={a.id === fromId}>
                    {a.name} — {rupiah(a.balance, { compact: true })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nominal (Rp)</Label>
            <Input
              className="mt-1"
              value={amount ? Number(amount).toLocaleString("id-ID") : ""}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div>
            <Label className="text-xs">Keterangan</Label>
            <Input
              className="mt-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opsional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={loading || !fromId || !toId || fromId === toId || !amount}
            onClick={async () => {
              const result = await onSubmit({
                fromAccountId: fromId,
                toAccountId: toId,
                amount: Number(amount),
                description: description.trim() || null,
              });
              if (result.success) onClose();
            }}
          >
            Pindahkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
