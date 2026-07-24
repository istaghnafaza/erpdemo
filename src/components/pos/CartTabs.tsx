import { Plus, ShoppingBag, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActiveCart } from "@/stores/pos.store";

// -----------------------------------------------------------------------------
// CartTabs — horizontal tab bar for up to 5 concurrent carts.
// -----------------------------------------------------------------------------

export interface CartTabsProps {
  carts: ActiveCart[];
  activeIndex: number;
  onSwitch: (index: number) => void;
  onAdd: () => void;
}

export function CartTabs({ carts, activeIndex, onSwitch, onAdd }: CartTabsProps) {
  const canAddMore = carts.some((c) => c.items.length === 0 && !c.isHeld);

  return (
    <div className="flex items-center gap-1 p-2 border-b bg-muted/40 overflow-x-auto">
      {carts.map((c, i) => {
        if (c.items.length === 0 && !c.isHeld && i !== activeIndex) return null;
        const label = c.isHeld ? (c.heldLabel ?? `Keranjang ${i + 1}`) : `Keranjang ${i + 1}`;
        return (
          <button
            key={i}
            onClick={() => onSwitch(i)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all",
              i === activeIndex
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:bg-background/50",
              c.isHeld && "opacity-70",
            )}
          >
            {c.isHeld ? <Lock className="h-3.5 w-3.5" /> : <ShoppingBag className="h-3.5 w-3.5" />}
            <span className="max-w-[140px] truncate">{c.customer ? c.customer.name : label}</span>
            {c.items.length > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] grid place-items-center font-bold">
                {c.items.length}
              </span>
            )}
          </button>
        );
      })}
      {canAddMore && (
        <Button variant="ghost" size="sm" onClick={onAdd} className="h-7 px-2 ml-auto shrink-0">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
