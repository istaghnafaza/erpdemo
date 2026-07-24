import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOnboardingStore } from "@/stores/onboarding.store";
import { cn } from "@/lib/utils";

const CHECKLIST = [
  { key: "path", label: "Pilih jalur setup" },
  { key: "store", label: "Info toko & cabang" },
  { key: "users", label: "Tambah user/kasir" },
  { key: "products", label: "Setup produk" },
] as const;

export function OnboardingProgressWidget() {
  const navigate = useNavigate();
  const isComplete = useOnboardingStore((s) => s.isComplete);
  const dismissed = useOnboardingStore((s) => s.dismissed);
  const path = useOnboardingStore((s) => s.path);
  const storeName = useOnboardingStore((s) => s.storeName);
  const users = useOnboardingStore((s) => s.users);
  const skippedUsers = useOnboardingStore((s) => s.skippedUsers);
  const products = useOnboardingStore((s) => s.products);
  const bookRows = useOnboardingStore((s) => s.bookRows);
  const excelRows = useOnboardingStore((s) => s.excelRows);
  const dismissTracker = useOnboardingStore((s) => s.dismissTracker);
  const resumeOnboarding = useOnboardingStore((s) => s.resumeOnboarding);
  const getProgressPercent = useOnboardingStore((s) => s.getProgressPercent);

  if (isComplete || dismissed) return null;

  const progress = getProgressPercent();
  const done = {
    path: !!path,
    store: !!storeName.trim(),
    users: skippedUsers || users.length > 0,
    products:
      (path === "new" && products.some((p) => p.selected)) ||
      path === "no-records" ||
      (path === "book" && bookRows.some((r) => r.name.trim())) ||
      (path === "excel" && excelRows.some((r) => r.valid)),
  };

  return (
    <aside className="fixed bottom-4 right-4 z-40 w-72 max-w-[calc(100vw-2rem)] rounded-xl border bg-card shadow-lg p-4 hidden sm:block">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-sm font-semibold">Setup Toko</div>
          <div className="text-xs text-muted-foreground">{progress}% selesai</div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={dismissTracker}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Progress value={progress} className="h-2 mb-3" />
      <ul className="space-y-1.5 mb-3">
        {CHECKLIST.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-xs">
            <CheckCircle2
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                done[item.key] ? "text-success" : "text-muted-foreground/40",
              )}
            />
            <span className={done[item.key] ? "text-foreground" : "text-muted-foreground"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        className="w-full bg-gradient-primary"
        onClick={() => {
          resumeOnboarding();
          navigate({ to: "/onboarding" });
        }}
      >
        Lanjutkan Setup
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </aside>
  );
}
