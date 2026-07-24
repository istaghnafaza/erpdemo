import { useState } from "react";
import { History, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  customerSegmentLabel,
  DELIVERY_SITE_TYPE_LABELS,
} from "@/lib/customer-delivery-utils";
import { SaveDeliverySiteDialog, MANUAL_DELIVERY_SITE_VALUE } from "@/components/pos/SaveDeliverySiteDialog";
import type { CustomerSegment, DeliverySiteType } from "@/types/customer-delivery-sites";
import type { CustomerDeliverySite } from "@/types/customer-delivery-sites";

export interface DeliverySiteSelectorProps {
  sites: CustomerDeliverySite[];
  segment: CustomerSegment | null;
  lastUsedSiteId: string | null;
  selectedSiteId: string | null;
  isManualMode: boolean;
  manualAddress: string;
  resolvedAddress: string | null;
  canSaveNewSite: boolean;
  onSelectSite: (siteId: string) => void;
  onManualAddressChange: (address: string) => void;
  onSaveNewSite: (payload: {
    label: string;
    address: string;
    siteType: DeliverySiteType;
  }) => void;
}

export function DeliverySiteSelector({
  sites,
  segment,
  lastUsedSiteId,
  selectedSiteId,
  isManualMode,
  manualAddress,
  resolvedAddress,
  canSaveNewSite,
  onSelectSite,
  onManualAddressChange,
  onSaveNewSite,
}: DeliverySiteSelectorProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const selectValue = isManualMode ? MANUAL_DELIVERY_SITE_VALUE : (selectedSiteId ?? undefined);

  const handleSelectChange = (value: string) => {
    if (value === MANUAL_DELIVERY_SITE_VALUE) {
      onSelectSite(MANUAL_DELIVERY_SITE_VALUE);
      return;
    }
    onSelectSite(value);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          Lokasi / Proyek
        </Label>
        {segment && (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {customerSegmentLabel(segment)}
          </Badge>
        )}
      </div>

      {sites.length === 0 && !isManualMode ? (
        <div className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground space-y-2">
          Tidak ada lokasi tersimpan — ketik alamat manual atau tambahkan di menu Pelanggan.
          <Textarea
            value={manualAddress}
            onChange={(e) => onManualAddressChange(e.target.value)}
            placeholder="Alamat pengiriman..."
            className="min-h-[60px] text-xs resize-none"
          />
          {canSaveNewSite && manualAddress.trim() && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => setSaveOpen(true)}
            >
              Simpan sebagai lokasi baru
            </Button>
          )}
        </div>
      ) : (
        <>
          <Select value={selectValue} onValueChange={handleSelectChange}>
            <SelectTrigger className="h-9 text-left">
              <SelectValue placeholder="Pilih lokasi / proyek" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  <span className="font-medium">{site.label}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {DELIVERY_SITE_TYPE_LABELS[site.siteType]}
                    {site.isDefault ? " · default" : ""}
                    {site.id === lastUsedSiteId ? " · terakhir" : ""}
                  </span>
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value={MANUAL_DELIVERY_SITE_VALUE}>
                Alamat lain (ketik manual)
              </SelectItem>
            </SelectContent>
          </Select>

          {lastUsedSiteId && sites.some((s) => s.id === lastUsedSiteId) && !isManualMode && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <History className="h-3 w-3" />
              Tercantum di struk · lokasi terakhir otomatis dipilih jika masih aktif
            </p>
          )}

          {isManualMode ? (
            <div className="space-y-2">
              <Textarea
                value={manualAddress}
                onChange={(e) => onManualAddressChange(e.target.value)}
                placeholder="Ketik alamat pengiriman..."
                className="min-h-[60px] text-xs resize-none"
              />
              {canSaveNewSite && manualAddress.trim() && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => setSaveOpen(true)}
                >
                  Simpan sebagai lokasi baru
                </Button>
              )}
            </div>
          ) : (
            resolvedAddress && (
              <p className="text-[11px] text-muted-foreground leading-snug">{resolvedAddress}</p>
            )
          )}
        </>
      )}

      <SaveDeliverySiteDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        initialAddress={manualAddress || resolvedAddress || ""}
        onSave={onSaveNewSite}
      />
    </div>
  );
}

export { MANUAL_DELIVERY_SITE_VALUE };
