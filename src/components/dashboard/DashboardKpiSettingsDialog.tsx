import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DASHBOARD_KPI_IDS,
  DASHBOARD_KPI_LABELS,
  type DashboardKpiId,
  useDashboardPreferencesStore,
} from "@/stores/dashboard-preferences.store";

export function DashboardKpiSettingsDialog() {
  const visibleKpis = useDashboardPreferencesStore((s) => s.visibleKpis);
  const setVisibleKpis = useDashboardPreferencesStore((s) => s.setVisibleKpis);
  const resetKpis = useDashboardPreferencesStore((s) => s.resetKpis);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DashboardKpiId[]>(visibleKpis);

  useEffect(() => {
    if (open) setDraft(visibleKpis);
  }, [open, visibleKpis]);

  const toggleDraft = (id: DashboardKpiId) => {
    setDraft((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((k) => k !== id);
      }
      return [...prev, id];
    });
  };

  const handleSave = () => {
    setVisibleKpis(draft);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <LayoutGrid className="h-4 w-4" />
          Atur KPI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kustomisasi Dashboard</DialogTitle>
          <DialogDescription>
            Pilih KPI yang ingin ditampilkan. Minimal satu KPI harus aktif.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {DASHBOARD_KPI_IDS.map((id) => (
            <label
              key={id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/40"
            >
              <Checkbox
                checked={draft.includes(id)}
                onCheckedChange={() => toggleDraft(id)}
              />
              <span className="text-sm font-medium">{DASHBOARD_KPI_LABELS[id]}</span>
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => resetKpis()}>
            Reset Default
          </Button>
          <Button type="button" onClick={handleSave}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
