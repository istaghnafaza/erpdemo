// =============================================================================
// useCustomerDeliverySitesPage — master pelanggan + lokasi pengiriman.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { useCustomerDeliverySitesStore } from "@/stores/customer-delivery-sites.store";
import {
  useCustomersStore,
  type TenantCustomerRecord,
} from "@/stores/customers.store";
import {
  customerSegmentLabel,
  isDeliverySiteActive,
  projectSiteStatusLabel,
  DELIVERY_SITE_TYPE_LABELS,
} from "@/lib/customer-delivery-utils";
import { canEdit } from "@/lib/rbac";
import { isMockTenantId } from "@/lib/mock-session";
import { createCustomer, getCustomers, updateCustomer as updateCustomerApi } from "@/lib/api/customers";
import { invalidatePosCustomers } from "@/lib/invalidate-pos-queries";
import { queryKeys } from "@/lib/query-keys";
import type { CustomerSegment } from "@/types/customer-delivery-sites";
import type { CustomerDeliverySite, DeliverySiteType } from "@/types/customer-delivery-sites";
import type { CustomerFormValues } from "@/components/customers/CustomerFormDialog";

export type SiteFormValues = {
  label: string;
  address: string;
  siteType: DeliverySiteType;
  contactName: string | null;
  contactPhone: string | null;
  isDefault: boolean;
  isActive: boolean;
};

function toTenantRecord(
  customer: TenantCustomerRecord | import("@/types/database").Customer,
  segment: CustomerSegment,
): TenantCustomerRecord {
  return {
    ...customer,
    segment,
    pricing_tier_id: "pricing_tier_id" in customer ? customer.pricing_tier_id ?? null : null,
  };
}

export function useCustomerDeliverySitesPage() {
  const user = useAuthStore((s) => s.currentUser?.profile);
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const isMockTenant = isMockTenantId(tenantId);
  const queryClient = useQueryClient();

  const sites = useCustomerDeliverySitesStore((s) => s.sites);
  const seedSitesIfEmpty = useCustomerDeliverySitesStore((s) => s.seedIfEmpty);
  const addSite = useCustomerDeliverySitesStore((s) => s.addSite);
  const updateSite = useCustomerDeliverySitesStore((s) => s.updateSite);
  const removeSite = useCustomerDeliverySitesStore((s) => s.removeSite);
  const getLastUsedSiteId = useCustomerDeliverySitesStore((s) => s.getLastUsedSiteId);

  const mockCustomers = useCustomersStore((s) => s.customers);
  const segmentById = useCustomersStore((s) => s.segmentById);
  const seedCustomersIfEmpty = useCustomersStore((s) => s.seedIfEmpty);
  const addCustomerLocal = useCustomersStore((s) => s.addCustomer);
  const updateCustomerLocal = useCustomersStore((s) => s.updateCustomer);
  const rememberSegment = useCustomersStore((s) => s.rememberSegment);
  const getSegment = useCustomersStore((s) => s.getSegment);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [siteFormOpen, setSiteFormOpen] = useState(false);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<CustomerDeliverySite | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<TenantCustomerRecord | null>(null);
  const [customerSaving, setCustomerSaving] = useState(false);

  useEffect(() => {
    if (isMockTenant) {
      seedCustomersIfEmpty();
    }
    seedSitesIfEmpty();
  }, [isMockTenant, seedCustomersIfEmpty, seedSitesIfEmpty]);

  const neonCustomersQuery = useQuery({
    queryKey: queryKeys.posCustomers(tenantId),
    queryFn: async () => {
      const result = await getCustomers(tenantId);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: Boolean(tenantId) && !isMockTenant,
    staleTime: 30_000,
  });

  const pricingQuery = useQuery({
    queryKey: queryKeys.pricingBundle(tenantId),
    queryFn: async () => {
      const { getPricingBundle } = await import("@/lib/api/pricing");
      const result = await getPricingBundle(tenantId);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });

  const customerTierOptions = useMemo(
    () =>
      (pricingQuery.data?.customer_tiers ?? [])
        .filter((t) => t.is_active)
        .map((t) => ({
          id: t.id,
          label: `${t.tier_code} · ${t.name} (−${t.discount_percent}%)`,
        })),
    [pricingQuery.data],
  );

  const tenantCustomers = useMemo((): TenantCustomerRecord[] => {
    if (isMockTenant) {
      return mockCustomers.filter((c) => c.tenant_id === tenantId);
    }
    return (neonCustomersQuery.data ?? []).map((c) =>
      toTenantRecord(c, getSegment(c.id) ?? segmentById[c.id] ?? "umum"),
    );
  }, [isMockTenant, mockCustomers, tenantId, neonCustomersQuery.data, getSegment, segmentById]);

  const canEditSites = canEdit(user?.role, "customers");

  const customerRows = useMemo(
    () =>
      tenantCustomers.map((customer) => {
        const customerSites = sites.filter((s) => s.customerId === customer.id);
        const activeCount = customerSites.filter((s) => isDeliverySiteActive(s)).length;
        return {
          customer,
          segment: customer.segment,
          segmentLabel: customerSegmentLabel(customer.segment),
          siteCount: customerSites.length,
          activeCount,
          lastUsedSiteId: getLastUsedSiteId(customer.id),
        };
      }),
    [tenantCustomers, sites, getLastUsedSiteId],
  );

  const selectedCustomer = useMemo(
    () => tenantCustomers.find((c) => c.id === selectedCustomerId) ?? null,
    [tenantCustomers, selectedCustomerId],
  );

  const selectedSites = useMemo(
    () => (selectedCustomer ? sites.filter((s) => s.customerId === selectedCustomer.id) : []),
    [selectedCustomer, sites],
  );

  const openAddCustomer = () => {
    setEditingCustomer(null);
    setCustomerFormOpen(true);
  };

  const openEditCustomer = (customer: TenantCustomerRecord) => {
    setEditingCustomer(customer);
    setCustomerFormOpen(true);
  };

  const handleCustomerFormSubmit = async (values: CustomerFormValues) => {
    if (!tenantId) return;

    if (isMockTenant) {
      if (editingCustomer) {
        updateCustomerLocal(editingCustomer.id, values);
        return;
      }
      const result = addCustomerLocal(tenantId, values);
      if (result.ok && result.customer) {
        setSelectedCustomerId(result.customer.id);
      }
      return;
    }

    setCustomerSaving(true);
    try {
      if (editingCustomer) {
        const result = await updateCustomerApi(tenantId, editingCustomer.id, {
          name: values.name,
          phone: values.phone ?? null,
          address: values.address ?? null,
          type: values.type,
          credit_limit: values.type === "credit" ? (values.credit_limit ?? 0) : 0,
          pricing_tier_id: values.pricing_tier_id,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (values.segment) {
          rememberSegment(editingCustomer.id, values.segment);
        }
        await invalidatePosCustomers(tenantId);
        await queryClient.invalidateQueries({ queryKey: queryKeys.posCustomers(tenantId) });
        toast.success("Pelanggan diperbarui");
        return;
      }

      const result = await createCustomer(tenantId, {
        name: values.name,
        phone: values.phone ?? null,
        address: values.address ?? null,
        type: values.type,
        credit_limit: values.type === "credit" ? (values.credit_limit ?? 0) : 0,
        outstanding_debt: 0,
        pricing_tier_id: values.pricing_tier_id,
      });
      if (result.error || !result.data) {
        toast.error(result.error ?? "Gagal menambah pelanggan");
        return;
      }
      rememberSegment(result.data.id, values.segment ?? "umum");
      await invalidatePosCustomers(tenantId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.posCustomers(tenantId) });
      setSelectedCustomerId(result.data.id);
      toast.success("Pelanggan ditambahkan — sudah tersedia di POS");
    } finally {
      setCustomerSaving(false);
    }
  };

  const openAddSite = () => {
    setEditingSite(null);
    setSiteFormOpen(true);
  };

  const openEditSite = (site: CustomerDeliverySite) => {
    setEditingSite(site);
    setSiteFormOpen(true);
  };

  const handleSiteFormSubmit = (values: SiteFormValues) => {
    if (!selectedCustomer || !tenantId) return;

    if (editingSite) {
      updateSite(editingSite.id, values);
      return;
    }

    addSite({
      tenantId,
      customerId: selectedCustomer.id,
      label: values.label,
      address: values.address,
      siteType: values.siteType,
      contactName: values.contactName,
      contactPhone: values.contactPhone,
      isDefault: values.isDefault,
    });
  };

  return {
    user,
    canEditSites,
    customerRows,
    customersLoading: !isMockTenant && neonCustomersQuery.isPending,
    customerSaving,
    customerTierOptions,
    selectedCustomerId,
    setSelectedCustomerId,
    selectedCustomer,
    selectedSites,
    siteFormOpen,
    setSiteFormOpen,
    customerFormOpen,
    setCustomerFormOpen,
    editingSite,
    editingCustomer,
    openAddCustomer,
    openEditCustomer,
    openAddSite,
    openEditSite,
    handleSiteFormSubmit,
    handleCustomerFormSubmit,
    removeSite,
    siteTypeLabels: DELIVERY_SITE_TYPE_LABELS,
    isDeliverySiteActive,
    projectSiteStatusLabel,
    getLastUsedSiteId,
  };
}
