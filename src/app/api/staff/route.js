import { authErrorResponse, hashPassword, normalizedPagePermissions, PAGE_PERMISSION_KEYS, requireStaff } from "@/lib/auth";
import { getRevisionPatch } from "@/lib/data-store";
import { prisma } from "@/lib/prisma";
import { normalizeStaffRole, roleCapabilities, ROLE_LABELS, STAFF_ROLES } from "@/features/access/roles";

export async function GET(request) {
  try {
    await requireAdminStaff();
    const users = await staffList();
    const url = new URL(request.url);
    if (url.searchParams.get("meta") === "1") {
      return Response.json({
        users,
        roles: STAFF_ROLES.map((role) => ({ role, label: ROLE_LABELS[role] }))
      });
    }
    return Response.json(users);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request) {
  try {
    const currentStaff = await requireAdminStaff();
    const body = await request.json();
    const saved = await upsertStaff(body);
    return Response.json({
      user: serializeStaff(saved),
      users: await staffList(),
      roles: STAFF_ROLES.map((role) => ({ role, label: ROLE_LABELS[role] })),
      currentUser: saved.id === currentStaff.id ? serializeStaff(saved) : null,
      _revisionPatch: await getRevisionPatch(["users"])
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request) {
  try {
    const currentStaff = await requireAdminStaff();
    const body = await request.json();
    const staffId = String(body?.id || "").trim();
    if (!staffId) throwBadRequest("Operatore mancante");
    if (staffId === currentStaff.id) throwBadRequest("L'account attualmente collegato non può essere eliminato");

    const existing = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!existing) throwNotFound("Operatore non trovato");
    if (existing.isAdmin) await ensureNotLastAdmin(staffId);

    await prisma.staff.delete({ where: { id: staffId } });
    return Response.json({ ok: true, users: await staffList(), _revisionPatch: await getRevisionPatch(["users"]) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

async function requireAdminStaff() {
  const staff = await requireStaff();
  if (!staff.isAdmin) {
    const error = new Error("Solo un amministratore può gestire operatori e ruoli");
    error.status = 403;
    throw error;
  }
  return staff;
}

async function upsertStaff(body = {}) {
  const staffId = String(body.id || "").trim();
  const name = String(body.name || "").trim();
  const username = String(body.username || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!name) throwBadRequest("Il nome dell'operatore è obbligatorio");
  if (!username) throwBadRequest("Il nome utente è obbligatorio");

  const existing = staffId ? await prisma.staff.findUnique({ where: { id: staffId } }) : null;
  if (staffId && !existing) throwNotFound("Operatore non trovato");
  if (!existing && !password) throwBadRequest("Per un nuovo operatore devi impostare una password");

  const usernameOwner = await prisma.staff.findUnique({ where: { username } });
  if (usernameOwner && usernameOwner.id !== staffId) throwConflict("Nome utente già utilizzato");

  const adminRequested = body.role === "ADMIN" || (body.role === undefined && Boolean(body.isAdmin));
  const role = normalizeStaffRole(body.role ?? existing?.role, adminRequested);
  const isAdmin = role === "ADMIN";
  if (existing?.isAdmin && !isAdmin) await ensureNotLastAdmin(staffId);

  const pagePermissions = isAdmin
    ? PAGE_PERMISSION_KEYS
    : normalizedPagePermissions({ role, isAdmin: false, pagePermissions: body.pagePermissions ?? existing?.pagePermissions });

  const data = { name, username, email, role, isAdmin, pagePermissions };
  if (password) data.passwordHash = hashPassword(password);

  if (existing) return prisma.staff.update({ where: { id: staffId }, data });
  return prisma.staff.create({ data: { id: staffId || undefined, ...data, passwordHash: data.passwordHash } });
}

async function ensureNotLastAdmin(staffId) {
  const adminCount = await prisma.staff.count({ where: { isAdmin: true } });
  const target = await prisma.staff.findUnique({ where: { id: staffId }, select: { isAdmin: true } });
  if (target?.isAdmin && adminCount <= 1) throwBadRequest("L'ultimo amministratore non può essere eliminato o declassato");
}

async function staffList() {
  const rows = await prisma.staff.findMany({ orderBy: [{ isAdmin: "desc" }, { createdAt: "asc" }] });
  return rows.map(serializeStaff);
}

function serializeStaff(staff) {
  const { passwordHash, sessionTokenHash, sessionExpiresAt, ...safeStaff } = staff;
  const role = normalizeStaffRole(staff.role, staff.isAdmin);
  return {
    ...safeStaff,
    role,
    roleLabel: ROLE_LABELS[role],
    capabilities: role === "CUSTOM" ? [] : roleCapabilities({ ...staff, role }),
    pagePermissions: staff.isAdmin ? PAGE_PERMISSION_KEYS : normalizedPagePermissions({ ...staff, role })
  };
}

function throwBadRequest(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function throwConflict(message) {
  const error = new Error(message);
  error.status = 409;
  throw error;
}

function throwNotFound(message) {
  const error = new Error(message);
  error.status = 404;
  throw error;
}
