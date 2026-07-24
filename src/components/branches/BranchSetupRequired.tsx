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
  onboardingComplete: _onboardingComplete,
  onSetup,
  className,
  compact,
}: BranchSetupRequiredProps) {
  if (isOwner) {
    return (
      <EmptyState
        icon={Store}
        title="Belum ada toko aktif"
        description="Buka wizard setup onboarding untuk menambahkan cabang/toko, produk awal, dan mulai operasional POS serta modul lainnya."
        actionLabel="Buka Wizard Setup Toko"
        onAction={onSetup}
        className={compact ? `py-10 ${className ?? ""}` : className}
      />
    );
  }

  return (
    <EmptyState
      icon={Store}
      title="Belum ada toko yang ditugaskan"
      description="Hubungi owner bisnis untuk menjalankan wizard setup toko atau mengaktifkan kembali cabang Anda."
      className={compact ? `py-10 ${className ?? ""}` : className}
    />
  );
}
