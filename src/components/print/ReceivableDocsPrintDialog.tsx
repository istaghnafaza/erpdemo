import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SalesDocsPrintDialog } from "@/components/print/SalesDocsPrintDialog";
import { getTransaction, getTransactionByNumber } from "@/lib/api/transactions";
import { getSalesOrder } from "@/lib/api/sales-orders";
import { isMockTenantId } from "@/lib/mock-session";
import {
  documentNumberFromArInvoice,
  invoiceFromSalesRecord,
  docsFromSalesOrder,
  mapDbSaleToRecord,
  summaryInvoiceFromAr,
  type InvoiceDoc,
} from "@/lib/print-docs";
import type { ReceiptData } from "@/lib/build-receipt-data";
import type { Receivable } from "@/lib/mock-data";
import { useSalesTransactionsStore } from "@/stores/sales-transactions.store";
import { useSalesOrdersStore } from "@/stores/sales-orders.store";
import type { SalesItem, SalesTransaction } from "@/types/database";

export function ReceivableDocsPrintDialog({
  open,
  onOpenChange,
  receivable,
  tenantId,
  customerName,
  branchName,
  branchAddress,
  branchPhone,
  storeName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivable: Receivable | null;
  tenantId: string;
  customerName: string;
  branchName: string;
  branchAddress: string | null;
  branchPhone: string | null;
  storeName: string;
}) {
  const [doc, setDoc] = useState<InvoiceDoc | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !receivable) {
      setDoc(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    toast.message("Menyiapkan dokumen cetak…");

    void (async () => {
      const fallback = summaryInvoiceFromAr({
        documentNumber: receivable.invoice,
        customerName,
        amount: receivable.amount,
        paid: receivable.paid,
        dueDate: receivable.dueDate,
        issuedDate: receivable.issuedDate,
        branchName,
        branchAddress,
        branchPhone,
        storeName,
      });

      const branchOpts = { branchAddress, branchPhone, storeName };

      try {
      if (isMockTenantId(tenantId)) {
        const tx = useSalesTransactionsStore
          .getState()
          .transactions.find(
            (t) =>
              t.transactionNumber === receivable.invoice ||
              t.transactionNumber === documentNumberFromArInvoice(receivable.invoice),
          );
        if (tx && !cancelled) {
          setDoc(invoiceFromSalesRecord(tx, { ...branchOpts, dueDate: receivable.dueDate }));
          setLoading(false);
          return;
        }
        const so = useSalesOrdersStore
          .getState()
          .mockOrders.find(
            (o) =>
              o.ar_invoice_number === receivable.invoice ||
              o.so_number === documentNumberFromArInvoice(receivable.invoice) ||
              o.pos_transaction_number === receivable.invoice,
          );
        if (so && !cancelled) {
          setDoc(
            docsFromSalesOrder(so, {
              branchName: branchName,
              ...branchOpts,
            }),
          );
          setLoading(false);
          return;
        }
        if (!cancelled) {
          setDoc(fallback);
          setLoading(false);
        }
        return;
      }

      const txId = receivable.salesTransactionId;
      if (txId) {
        const full = await getTransaction(tenantId, txId);
        if (!cancelled && full.data) {
          setDoc(
            invoiceFromDbSale(full.data, {
              branchName,
              ...branchOpts,
              dueDate: receivable.dueDate,
            }),
          );
          setLoading(false);
          return;
        }
      }

      const txNumber = documentNumberFromArInvoice(receivable.invoice);
      const byNumber = await getTransactionByNumber(tenantId, txNumber);
      if (!cancelled && byNumber.data) {
        const full = await getTransaction(tenantId, byNumber.data.id);
        if (full.data) {
          setDoc(
            invoiceFromDbSale(full.data, {
              branchName,
              ...branchOpts,
              dueDate: receivable.dueDate,
            }),
          );
          setLoading(false);
          return;
        }
      }

      const soId = receivable.salesOrderId;
      if (soId) {
        const so = await getSalesOrder(tenantId, soId);
        if (!cancelled && so.data) {
          setDoc(
            docsFromSalesOrder(so.data, {
              branchName,
              ...branchOpts,
            }),
          );
          setLoading(false);
          return;
        }
      }

      if (!cancelled) {
        setDoc(fallback);
        setLoading(false);
      }
      } catch {
        if (!cancelled) {
          setDoc(fallback);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    receivable,
    tenantId,
    customerName,
    branchName,
    branchAddress,
    branchPhone,
    storeName,
  ]);

  const receipt: ReceiptData | null = doc;

  return (
    <SalesDocsPrintDialog
      open={open && !loading && !!doc}
      onOpenChange={onOpenChange}
      receipt={receipt}
      invoice={doc}
      tenantId={tenantId}
      branchId={receivable?.branchId}
      title="Cetak piutang"
    />
  );
}

function invoiceFromDbSale(
  tx: SalesTransaction & { items?: SalesItem[] },
  opts: {
    branchName: string;
    branchAddress?: string | null;
    branchPhone?: string | null;
    storeName?: string;
    dueDate?: string | null;
  },
): InvoiceDoc {
  const items = tx.items ?? [];
  const record = mapDbSaleToRecord({ ...tx, items }, { branchName: opts.branchName });
  return invoiceFromSalesRecord(record, {
    branchAddress: opts.branchAddress,
    branchPhone: opts.branchPhone,
    storeName: opts.storeName,
    dueDate: opts.dueDate,
  });
}
