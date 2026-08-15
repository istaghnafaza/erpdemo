import type { ProfitLossSummary } from "@/lib/finance-calculations";

export interface OpenReceivableRow {
  id: string;
  branchId: string;
  invoiceNumber: string;
  customerName: string;
  remainingAmount: number;
  dueDate: string;
  status: string;
}

export interface CashVsAccrualReport {
  kasRiil: number;
  labaAkuntansi: ProfitLossSummary;
  openArTotal: number;
  openReceivables: OpenReceivableRow[];
}

export interface ForecastDay {
  date: string;
  label: string;
  arDue: number;
  apDue: number;
  avgPosIn: number;
  projectedBalance: number;
}

export interface CashForecastReport {
  startingBalance: number;
  avgDailyPosIn: number;
  days: ForecastDay[];
  minBalance: number;
  endBalance: number;
  goesNegative: boolean;
  firstNegativeDate: string | null;
}

export type CashLockBucket = "fast" | "slow" | "dead";

export interface CashLockRow {
  productId: string;
  sku: string;
  name: string;
  categoryName: string | null;
  stock: number;
  unitCost: number;
  lockedValue: number;
  daysSinceOutbound: number | null;
  bucket: CashLockBucket;
  flag: "kandidat_diskon" | "stop_reorder" | null;
}

export interface CashLockReport {
  rows: CashLockRow[];
  fastValue: number;
  slowValue: number;
  deadValue: number;
  totalLocked: number;
}

export interface CashflowDashboardKpis {
  kasRiil: number;
  labaNet: number;
  openArTotal: number;
  forecastEnd30: number;
  forecastGoesNegative: boolean;
  firstNegativeDate: string | null;
  deadStockValue: number;
  slowStockValue: number;
  arDue30: number;
  apDue30: number;
}
