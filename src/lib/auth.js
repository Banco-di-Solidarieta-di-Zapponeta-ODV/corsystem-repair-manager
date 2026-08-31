import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, hasRoleCapability, normalizeStaffRole } from "@/features/access/roles";

const COOKIE_NAME = "repairnote_session";
const SESSION_DAYS = 7;
export const PAGE_PERMISSION_KEYS = [
  "repairs",
  "clients",
  "categories",
  "modules",
  "services",
  "attributes",
  "technicians",
  "reports",
  "finance",
  "settings",
  "backup"
];

const ROLE_PAGE_PERMISSIONS = {
  ADMIN: PAGE_PERMISSION_KEYS,
  FRONT_OFFICE: ["repairs", "clients", "finance"],
  TECHNICIAN: ["repairs", "technicians"],
  INVENTORY: ["repairs", "services", "modules"],
  CUSTOM: []
};

const CUSTOM_CAPABILITY_PAGES = {
  [CAPABILITIES.DASHBOARD_VIEW]: ["repairs", "reports", "finance"],
  [CAPABILITIES.DASHBOARD_FINANCE]: ["finance", "reports"],
  [CAPABILITIES.REPAIR_VIEW]: ["repairs"],
  [CAPABILITIES.CLIENT_MANAGE]: ["clients"],
  [CAPABILITIES.INTAKE_CREATE]: ["repairs"],
  [CAPABILITIES.DEVICE_MANAGE]: ["clients", "repairs"],
  [CAPABILITIES.DIAGNOSIS_MANAGE]: ["repairs"],
  [CAPABILITIES.QUOTE_MANAGE]: ["repairs"],
  [CAPABILITIES.INVENTORY_VIEW]: ["services", "modules", "repairs"],
  [CAPABILITIES.INVENTORY_MANAGE]: ["services", "modules"],
  [CAPABILITIES.REPAIR_PARTS_MANAGE]: ["repairs"],
  [CAPABILITIES.FINAL_TEST_MANAGE]: ["repairs"],
  [CAPABILITIES.PAYMENT_MANAGE]: ["finance"],
  [CAPABILITIES.DELIVERY_MANAGE]: ["finance"],
  [CAPABILITIES.NOTIFICATIONS_VIEW]: ["repairs", "settings"],
  [CAPABILITIES.NOTIFICATIONS_MANAGE]: ["settings"],
  [CAPABILITIES.SETTINGS_MANAGE]: ["settings"],
  [CAPABILITIES.REPORTS_VIEW]: ["reports"],
  [CAPABILITIES.BACKUP_MANAGE]: ["backup"]
};

function secureCookieEnabled() {
  if (process.env.REPAIRNOTE_COOKIE_SECURE === "false") return false;
  if (process.env.REPAIRNOTE_COOKIE_SECURE === "true") return true;
  return process.env.NODE_ENV === "production";
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const candidate = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(staffId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const tokenHash = hashToken(token);
  await prisma.$transaction([
    prisma.staffSession.deleteMany({ where: { staffId, expiresAt: { lte: new Date() } } }),
    prisma.staffSession.create({ data: { staffId, tokenHash, expiresAt } }),
    prisma.staff.update({ where: { id: staffId }, data: { sessionTokenHash: tokenHash, sessionExpiresAt: expiresAt } })
  ]);
  await setSessionCookie(token, expiresAt);
}

async function setSessionCookie(token, expiresAt) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookieEnabled(),
    path: "/",
    expires: expiresAt
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) await prisma.staffSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(COOKIE_NAME);
}

const STAFF_SESSION_SELECT = {
  id: true,
  name: true,
  username: true,
  email: true,
  isAdmin: true,
  role: true,
  pagePermissions: true
};

export async function getCurrentStaff() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await prisma.staffSession.findUnique({
    where: { tokenHash },
    include: { staff: { select: STAFF_SESSION_SELECT } }
  });
  if (session?.expiresAt > new Date()) return normalizeStaffIdentity(session.staff);

  if (session) {
    await prisma.staffSession.delete({ where: { id: session.id } });
    return null;
  }

  const staff = await prisma.staff.findFirst({
    where: { sessionTokenHash: tokenHash, sessionExpiresAt: { gt: new Date() } },
    select: STAFF_SESSION_SELECT
  });
  return normalizeStaffIdentity(staff);
}

function normalizeStaffIdentity(staff) {
  if (!staff) return null;
  return { ...staff, role: normalizeStaffRole(staff.role, staff.isAdmin) };
}

export async function requireStaff() {
  const staff = await getCurrentStaff();
  if (!staff) {
    const error = new Error("Accesso richiesto");
    error.status = 401;
    throw error;
  }
  return staff;
}

export function normalizedPagePermissions(staff) {
  if (staff?.isAdmin) return PAGE_PERMISSION_KEYS;
  const role = normalizeStaffRole(staff?.role, staff?.isAdmin);
  if (role !== "CUSTOM") return ROLE_PAGE_PERMISSIONS[role] || [];

  const rawPermissions = Array.isArray(staff?.pagePermissions) ? staff.pagePermissions : [];
  const permissions = rawPermissions
    .map((key) => key === "warranties" ? "repairs" : key)
    .filter((key) => PAGE_PERMISSION_KEYS.includes(key));
  return [...new Set(permissions)];
}

export function canAccessPage(staff, key) {
  if (!staff) return false;
  if (staff.isAdmin) return true;
  return normalizedPagePermissions(staff).includes(key);
}

export function hasCapability(staff, capability) {
  if (!staff) return false;
  if (staff.isAdmin || hasRoleCapability(staff, capability)) return true;
  if (normalizeStaffRole(staff.role, staff.isAdmin) !== "CUSTOM") return false;
  const pages = CUSTOM_CAPABILITY_PAGES[capability] || [];
  return pages.some((page) => canAccessPage(staff, page));
}

export async function requireCapability(capability) {
  const staff = await requireStaff();
  if (!hasCapability(staff, capability)) {
    const error = new Error("Non hai i permessi necessari per questa operazione");
    error.status = 403;
    throw error;
  }
  return staff;
}

export async function requireAnyCapability(capabilities = []) {
  const staff = await requireStaff();
  if (!capabilities.some((capability) => hasCapability(staff, capability))) {
    const error = new Error("Non hai i permessi necessari per questa operazione");
    error.status = 403;
    throw error;
  }
  return staff;
}

export async function requirePageAccess(key) {
  const staff = await requireStaff();
  if (!canAccessPage(staff, key)) {
    const error = new Error("Non hai accesso a questa sezione");
    error.status = 403;
    throw error;
  }
  return staff;
}

export async function requireAnyPageAccess(keys = PAGE_PERMISSION_KEYS) {
  const staff = await requireStaff();
  if (!staff.isAdmin && !keys.some((key) => canAccessPage(staff, key))) {
    const error = new Error("Non hai accesso a questa sezione");
    error.status = 403;
    throw error;
  }
  return staff;
}

export function authErrorResponse(error) {
  if (error?.status === 401) return Response.json({ error: error.message || "Accedi per continuare" }, { status: 401 });
  if (error?.status === 400) return Response.json({ error: error.message || "Richiesta non valida" }, { status: 400 });
  if (error?.status === 403) return Response.json({ error: error.message || "Operazione non autorizzata" }, { status: 403 });
  if (error?.status === 409) return Response.json({ error: error.message || "I dati sono cambiati. Aggiorna e riprova." }, { status: 409 });
  if (error?.status === 404) return Response.json({ error: error.message || "Dato non trovato" }, { status: 404 });
  return Response.json({ error: error?.message || "Errore del server" }, { status: 500 });
}
