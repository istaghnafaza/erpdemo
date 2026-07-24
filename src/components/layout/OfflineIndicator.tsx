import { WifiOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useOfflineStore } from "@/stores/offline.store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const pendingCount = useOfflineStore((s) => s.pendingCount);
  const syncStatus = useOfflineStore((s) => s.syncStatus);
  const syncProgress = useOfflineStore((s) => s.syncProgress);
  const syncMessage = useOfflineStore((s) => s.syncMessage);
  const syncQueue = useOfflineStore((s) => s.syncQueue);
  const failedCount = useOfflineStore((s) => s.txQueue.filter((t) => t.syncStatus === "failed").length);

  const showBanner =
    !isOnline ||
    pendingCount > 0 ||
    failedCount > 0 ||
    syncStatus === "syncing" ||
    syncStatus === "success" ||
    syncStatus === "error" ||
    !!syncMessage;

  if (!showBanner) return null;

  const isError = syncStatus === "error";
  const isSuccess =
    syncStatus === "success" &&
    (syncMessage?.includes("tersinkron") ?? false);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 lg:px-8 py-2 text-sm font-medium",
        !isOnline
          ? "bg-destructive text-destructive-foreground"
          : isError
            ? "bg-destructive/90 text-destructive-foreground"
            : isSuccess
              ? "bg-success text-success-foreground"
              : "bg-warning text-warning-foreground",
      )}
    >
      {!isOnline ? (
        <WifiOff className="h-4 w-4 shrink-0" />
      ) : isSuccess ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : isError ? (
        <AlertCircle className="h-4 w-4 shrink-0" />
      ) : (
        <RefreshCw
          className={cn("h-4 w-4 shrink-0", syncStatus === "syncing" && "animate-spin")}
        />
      )}
      <span className="flex-1 min-w-0 truncate">
        {!isOnline
          ? `⚠️ OFFLINE MODE — ${pendingCount} transaksi menunggu sinkronisasi`
          : syncStatus === "syncing" && syncProgress
            ? `Menyinkronkan ${syncProgress.current}/${syncProgress.total}...`
            : syncMessage
              ? syncMessage
              : pendingCount > 0
                ? `${pendingCount} transaksi menunggu sinkronisasi`
                : failedCount > 0
                  ? `${failedCount} transaksi gagal disinkronkan`
                  : "Menyiapkan sinkronisasi..."}
      </span>
      {isOnline && (pendingCount > 0 || failedCount > 0) && syncStatus !== "syncing" && (
        <Button
          size="sm"
          variant="secondary"
          className="h-7 shrink-0"
          onClick={() => void syncQueue({ retryFailed: failedCount > 0 })}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          {failedCount > 0 ? "Coba Lagi" : "Sinkronkan"}
        </Button>
      )}
    </div>
  );
}
