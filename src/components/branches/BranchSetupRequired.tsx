import { Store } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface BranchSetupRequiredProps {
  isOwner: boolean;
  onboardingComplete: boolean;
  onSetup?: () => void;
  className?: string;
  compact?: boolean;
}

export function BranchSetupRequired({
  isOwner,
  onboardingComplete,
  onSetup,
  className,
  compact,
}: BranchSetupRequiredProps) {
  if (isOwner) {
    return (
      <EmptyState
        icon={Store}
        title={onboardingComplete ? "Belum ada toko aktif" : "Setup toko belum selesai"}
        description={
          onboardingComplete
            ? "Tambahkan cabang/toko untuk mulai operasional POS dan modul lainnya."
            : "Lengkapi wizard setup toko — info bisnis, cabang, user, dan produk awal — agar modul operasional dapat dipakai."
        }
        actionLabel={onboardingComplete ? "Tambah Cabang" : "Setup Toko"}
        onAction={onSetup}
        className={compact ? `py-10 ${className ?? ""}` : className}
      />
    );
  }

  return (
    <EmptyState
      icon={Store}
      title={onboardingComplete ? "Belum ada toko aktif" : "Setup toko belum selesai"}
      description="Hubungi owner bisnis untuk mengaktifkan cabang atau menyelesaikan setup toko."
      className={compact ? `py-10 ${className ?? ""}` : className}
    />
  );
}
