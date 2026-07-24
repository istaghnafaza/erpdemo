// =============================================================================
// useCustomerDeliverySitesPage — master pelanggan + lokasi pengiriman.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
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

export function useCustomerDeliverySitesPage() {
  const user = useAuthStore((s) => s.currentUser?.profile);
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const sites = useCustomerDeliverySitesStore((s) => s.sites);
  const seedSitesIfEmpty = useCustomerDeliverySitesStore((s) => s.seedIfEmpty);
  const addSite = useCustomerDeliverySitesStore((s) => s.addSite);
  const updateSite = useCustomerDeliverySitesStore((s) => s.updateSite);
  const removeSite = useCustomerDeliverySitesStore((s) => s.removeSite);
  const getLastUsedSiteId = useCustomerDeliverySitesStore((s) => s.getLastUsedSiteId);

  const customers = useCustomersStore((s) => s.customers);
  const seedCustomersIfEmpty = useCustomersStore((s) => s.seedIfEmpty);
  const addCustomer = useCustomersStore((s) => s.addCustomer);
  const updateCustomer = useCustomersStore((s) => s.updateCustomer);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [siteFormOpen, setSiteFormOpen] = useState(false);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<CustomerDeliverySite | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<TenantCustomerRecord | null>(null);

  useEffect(() => {
    seedCustomersIfEmpty();
    seedSitesIfEmpty();
  }, [seedCustomersIfEmpty, seedSitesIfEmpty]);

  const tenantCustomers = useMemo(
    () => customers.filter((c) => c.tenant_id === tenantId),
    [customers, tenantId],
  );

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

  const selectedCustomer =
    tenantCustomers.find((c) => c.id === selectedCustomerId) ?? null;

  const selectedSites = useMemo(() => {
    if (!selectedCustomerId) return [];
    return sites
      .filter((s) => s.customerId === selectedCustomerId)
      .sort((a, b) => a.label.localeCompare(b.label, "id"));
  }, [sites, selectedCustomerId]);

  const openAddCustomer = () => {
    setEditingCustomer(null);
    setCustomerFormOpen(true);
  };

  const openEditCustomer = (customer: TenantCustomerRecord) => {
    setEditingCustomer(customer);
    setCustomerFormOpen(true);
  };

  const handleCustomerFormSubmit = (values: CustomerFormValues) => {
    if (!tenantId) return;

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, values);
      return;
    }

    const result = addCustomer(tenantId, values);
    if (result.ok && result.customer) {
      setSelectedCustomerId(result.customer.id);
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
