import { CartTabs } from "@/components/pos/CartTabs";
import { CartPanel } from "@/components/pos/CartPanel";
import { PaymentPanel } from "@/components/pos/PaymentPanel";
import { Card } from "@/components/ui/card";
import type { PartialShipLine } from "@/lib/pos-partial-shipment";
import type { PosReturnOffset } from "@/lib/pos-return-offset";
import type { ActiveCart } from "@/stores/pos.store";
import type { Customer } from "@/types/database";
import type { PaymentMethod } from "@/types/app";
import type { OrderFulfillmentType } from "@/types/sales-transactions";
import type {
  CustomerDeliverySite,
  CustomerSegment,
  DeliverySiteType,
} from "@/types/customer-delivery-sites";

export interface PosCartColumnProps {
  carts: ActiveCart[];
  activeCartIndex: number;
  activeCart: ActiveCart;
  activeCartSubtotal: number;
  activeCartTotal: number;
  activeCartDiscountAmount: number;
  customers: Customer[];
  heldCarts: ActiveCart[];
  activeDeliverySites: CustomerDeliverySite[];
  customerSegment: CustomerSegment | null;
  lastUsedSiteId: string | null;
  isProcessing: boolean;
  isOnline: boolean;
  activeOrderFulfillmentType: OrderFulfillmentType;
  partialShip: PartialShipLine[];
  onSwitchCart: (index: number) => void;
  onAddCart: () => void;
  onUpdateQty: (itemIndex: number, qty: number) => void;
  onRemoveItem: (itemIndex: number) => void;
  onSetDiscount: (percent: number) => void;
  onSetCustomer: (customer: Customer | null) => void;
  onAddCustomer: () => void;
  onSetDeliverySite: (siteId: string) => void;
  onManualDeliveryAddressChange: (address: string) => void;
  onSaveNewDeliverySite: (payload: {
    label: string;
    address: string;
    siteType: DeliverySiteType;
  }) => void;
  onToggleItemSoLine: (itemIndex: number) => void;
  onSetNotes: (notes: string) => void;
  onHold: () => void;
  onClear: () => void;
  onOpenTakeover: () => void;
  onOrderFulfillmentTypeChange: (type: OrderFulfillmentType) => void;
  onPartialShipLineChange: (
    itemIndex: number,
    patch: { selected?: boolean; shipQty?: number },
  ) => void;
  onPay: (
    method: PaymentMethod,
    amountPaid: number,
  ) => void | Promise<{ success: boolean; error?: string }>;
  tenantId: string;
  branchId: string;
  onReturnOffsetChange: (offset: PosReturnOffset | null) => void;
}

export function PosCartColumn({
  carts,
  activeCartIndex,
  activeCart,
  activeCartSubtotal,
  activeCartTotal,
  activeCartDiscountAmount,
  customers,
  heldCarts,
  activeDeliverySites,
  customerSegment,
  lastUsedSiteId,
  isProcessing,
  isOnline,
  activeOrderFulfillmentType,
  partialShip,
  onSwitchCart,
  onAddCart,
  onUpdateQty,
  onRemoveItem,
  onSetDiscount,
  onSetCustomer,
  onAddCustomer,
  onSetDeliverySite,
  onManualDeliveryAddressChange,
  onSaveNewDeliverySite,
  onToggleItemSoLine,
  onSetNotes,
  onHold,
  onClear,
  onOpenTakeover,
  onOrderFulfillmentTypeChange,
  onPartialShipLineChange,
  onPay,
  tenantId,
  branchId,
  onReturnOffsetChange,
}: PosCartColumnProps) {
  return (
    <div className="flex flex-col gap-4 min-h-0">
      <Card className="flex flex-col overflow-hidden min-h-0">
        <CartTabs
          carts={carts}
          activeIndex={activeCartIndex}
          onSwitch={onSwitchCart}
          onAdd={onAddCart}
        />
        <CartPanel
          cart={activeCart}
          subtotal={activeCartSubtotal}
          discountAmount={activeCartDiscountAmount}
          customers={customers}
          deliverySites={activeDeliverySites}
          customerSegment={customerSegment}
          orderFulfillmentType={activeOrderFulfillmentType}
          lastUsedSiteId={lastUsedSiteId}
          heldCartCount={heldCarts.length}
          onUpdateQty={onUpdateQty}
          onRemoveItem={onRemoveItem}
          onSetDiscount={onSetDiscount}
          onSetCustomer={onSetCustomer}
          onAddCustomer={onAddCustomer}
          onSetDeliverySite={onSetDeliverySite}
          onManualDeliveryAddressChange={onManualDeliveryAddressChange}
          onSaveNewDeliverySite={onSaveNewDeliverySite}
          onToggleItemSoLine={onToggleItemSoLine}
          onSetNotes={onSetNotes}
          onHold={onHold}
          onClear={onClear}
          onOpenTakeover={onOpenTakeover}
        />
      </Card>

      <PaymentPanel
        cart={activeCart}
        subtotal={activeCartSubtotal}
        discountAmount={activeCartDiscountAmount}
        total={activeCartTotal}
        isProcessing={isProcessing}
        isOnline={isOnline}
        orderFulfillmentType={activeOrderFulfillmentType}
        onOrderFulfillmentTypeChange={onOrderFulfillmentTypeChange}
        partialShip={partialShip}
        onPartialShipLineChange={onPartialShipLineChange}
        onPay={onPay}
        tenantId={tenantId}
        branchId={branchId}
        onReturnOffsetChange={onReturnOffsetChange}
      />
    </div>
  );
}
