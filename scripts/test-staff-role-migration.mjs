import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const admin = await prisma.staff.findUnique({ where: { id: "staff-admin-legacy" } });
  const custom = await prisma.staff.findUnique({ where: { id: "staff-custom-legacy" } });

  assert(admin, "Legacy admin fixture missing");
  assert(custom, "Legacy custom fixture missing");
  assert(admin.isAdmin === true, "Legacy admin must remain administrator");
  assert(admin.role === "ADMIN", `Legacy admin must migrate to ADMIN, found ${admin.role}`);
  assert(custom.isAdmin === false, "Legacy operator must remain non-admin");
  assert(custom.role === "CUSTOM", `Legacy non-admin must remain CUSTOM, found ${custom.role}`);

  const permissions = Array.isArray(custom.pagePermissions) ? custom.pagePermissions : [];
  assert(permissions.includes("repairs") && permissions.includes("clients"), "Legacy custom page permissions must be preserved");

  console.log("Staff role migration verified: admins become ADMIN; non-admin legacy accounts remain CUSTOM with permissions preserved.");
} finally {
  await prisma.$disconnect();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
