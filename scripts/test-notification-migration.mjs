import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const notificationCount = await prisma.notification.count();
  assert(notificationCount === 0, `Notification migration must not invent legacy messages, found ${notificationCount}`);

  const repair = await prisma.repair.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  assert(repair, "Expected at least one legacy repair fixture");

  const created = await prisma.notification.create({
    data: {
      repairId: repair.id,
      event: "READY",
      channel: "email",
      status: "QUEUED",
      provider: "resend",
      recipient: "cliente@example.it",
      subject: "Test CorSystem",
      body: "Messaggio di verifica della coda notifiche",
      lastError: "",
      dedupeKey: `ci:${repair.id}:ready:email`
    },
    include: { repair: { select: { id: true } } }
  });

  assert(created.repair.id === repair.id, "Notification relation to Repair is broken");
  assert(created.status === "QUEUED", "Notification default/queued state is not usable");
  assert(created.attempts === 0, "Fresh notification attempts must start at zero");

  await prisma.notification.delete({ where: { id: created.id } });
  assert((await prisma.notification.count()) === 0, "Notification test cleanup failed");

  console.log("Notification migration verified: no historical messages invented and persistent queue relation works.");
} finally {
  await prisma.$disconnect();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
