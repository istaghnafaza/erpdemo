import { Card } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import {
  AGING_BUCKET_LABELS,
  computeAgingBuckets,
  type AgingBucket,
  type AgingLineItem,
} from "@/lib/ar-ap-utils";
import { cn } from "@/lib/utils";

const BUCKET_ORDER: AgingBucket[] = ["current", "0-30", "31-60", "61-90", "90+"];

const BUCKET_COLORS: Record<AgingBucket, string> = {
  current: "bg-success",
  "0-30": "bg-warning",
  "31-60": "bg-orange-500",
  "61-90": "bg-destructive/70",
  "90+": "bg-destructive",
};

interface AgingSummaryCardProps {
  title?: string;
  items: AgingLineItem[];
}

export function AgingSummaryCard({ title = "Aging Summary", items }: AgingSummaryCardProps) {
  const buckets = computeAgingBuckets(items);
  const total = BUCKET_ORDER.reduce((s, k) => s + buckets[k], 0) || 1;

  return (
    <Card className="p-5 mb-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden flex mb-4">
        {BUCKET_ORDER.map((key) =>
          buckets[key] > 0 ? (
            <div
              key={key}
              className={BUCKET_COLORS[key]}
              style={{ width: `${(buckets[key] / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {BUCKET_ORDER.map((key) => (
          <div key={key}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-sm shrink-0", BUCKET_COLORS[key])} />
              {AGING_BUCKET_LABELS[key]}
            </div>
            <div className="text-base font-bold mt-1">
              <CurrencyDisplay value={buckets[key]} compact />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
