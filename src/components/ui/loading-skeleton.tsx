import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// LoadingSkeleton — reusable loading placeholders for common layout shapes,
// built on top of the base Skeleton primitive.
// -----------------------------------------------------------------------------

export interface LoadingSkeletonProps {
  variant?: "card" | "table-row" | "kpi" | "text" | "avatar-line";
  /** Number of repeated rows (only used by "table-row" and "text"). */
  count?: number;
  className?: string;
}

export function LoadingSkeleton({ variant = "text", count = 3, className }: LoadingSkeletonProps) {
  if (variant === "card") {
    return (
      <div className={cn("rounded-xl border bg-card p-5 space-y-3", className)}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  if (variant === "kpi") {
    return (
      <div className={cn("rounded-xl border bg-card p-5 space-y-3", className)}>
        <div className="flex items-start justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
    );
  }

  if (variant === "table-row") {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2.5">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "avatar-line") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    );
  }

  // "text"
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === count - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
