export const STAFF_ROLES = ["ADMIN", "FRONT_OFFICE", "TECHNICIAN", "INVENTORY", "CUSTOM"];

export const ROLE_LABELS = {
  ADMIN: "Amministratore",
  FRONT_OFFICE: "Front Office",
  TECHNICIAN: "Tecnico",
  INVENTORY: "Magazzino",
  CUSTOM: "Personalizzato legacy"
};

export const CAPABILITIES = {
  DASHBOARD_VIEW: "dashboard.view",
  DASHBOARD_FINANCE: "dashboard.finance",
  REPAIR_VIEW: "repair.view",
  CLIENT_MANAGE: "client.manage",
  INTAKE_CREATE: "intake.create",
  DEVICE_MANAGE: "device.manage",
  DIAGNOSIS_MANAGE: "diagnosis.manage",
  QUOTE_MANAGE: "quote.manage",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_MANAGE: "inventory.manage",
  REPAIR_PARTS_MANAGE: "repair-parts.manage",
  FINAL_TEST_MANAGE: "final-test.manage",
  PAYMENT_MANAGE: "payment.manage",
  DELIVERY_MANAGE: "delivery.manage",
  NOTIFICATIONS_VIEW: "notifications.view",
  NOTIFICATIONS_MANAGE: "notifications.manage",
  STAFF_MANAGE: "staff.manage",
  SETTINGS_MANAGE: "settings.manage",
  REPORTS_VIEW: "reports.view",
  BACKUP_MANAGE: "backup.manage"
};

const ALL_CAPABILITIES = Object.values(CAPABILITIES);

export const ROLE_CAPABILITIES = {
  ADMIN: ALL_CAPABILITIES,
  FRONT_OFFICE: [
    CAPABILITIES.DASHBOARD_VIEW,
    CAPABILITIES.REPAIR_VIEW,
    CAPABILITIES.CLIENT_MANAGE,
    CAPABILITIES.INTAKE_CREATE,
    CAPABILITIES.DEVICE_MANAGE,
    CAPABILITIES.QUOTE_MANAGE,
    CAPABILITIES.PAYMENT_MANAGE,
    CAPABILITIES.DELIVERY_MANAGE,
    CAPABILITIES.NOTIFICATIONS_VIEW,
    CAPABILITIES.NOTIFICATIONS_MANAGE
  ],
  TECHNICIAN: [
    CAPABILITIES.DASHBOARD_VIEW,
    CAPABILITIES.REPAIR_VIEW,
    CAPABILITIES.DIAGNOSIS_MANAGE,
    CAPABILITIES.QUOTE_MANAGE,
    CAPABILITIES.INVENTORY_VIEW,
    CAPABILITIES.REPAIR_PARTS_MANAGE,
    CAPABILITIES.FINAL_TEST_MANAGE
  ],
  INVENTORY: [
    CAPABILITIES.DASHBOARD_VIEW,
    CAPABILITIES.REPAIR_VIEW,
    CAPABILITIES.INVENTORY_VIEW,
    CAPABILITIES.INVENTORY_MANAGE,
    CAPABILITIES.REPAIR_PARTS_MANAGE
  ],
  CUSTOM: []
};

export function normalizeStaffRole(value, isAdmin = false) {
  if (isAdmin) return "ADMIN";
  const role = String(value || "CUSTOM").trim().toUpperCase();
  return STAFF_ROLES.includes(role) && role !== "ADMIN" ? role : "CUSTOM";
}

export function roleCapabilities(staff) {
  if (!staff) return [];
  const role = normalizeStaffRole(staff.role, staff.isAdmin);
  return ROLE_CAPABILITIES[role] || [];
}

export function hasRoleCapability(staff, capability) {
  if (!staff || !capability) return false;
  if (staff.isAdmin) return true;
  return roleCapabilities(staff).includes(capability);
}

export function roleSummary(role) {
  const normalized = normalizeStaffRole(role, role === "ADMIN");
  return {
    role: normalized,
    label: ROLE_LABELS[normalized],
    capabilities: ROLE_CAPABILITIES[normalized] || []
  };
}
