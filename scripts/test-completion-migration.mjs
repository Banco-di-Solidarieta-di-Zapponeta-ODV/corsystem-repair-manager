import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const [repairCount, testCount, deliveryCount] = await Promise.all([
    prisma.repair.count(),
    prisma.repairTest.count(),
    prisma.deliveryRecord.count()
  ]);

  assert(repairCount === 4, `Expected 4 legacy repairs, found ${repairCount}`);
  assert(testCount === 0, `Completion migration must not invent final tests, found ${testCount}`);
  assert(deliveryCount === 0, `Completion migration must not invent delivery records, found ${deliveryCount}`);

  const repairs = await prisma.repair.findMany({
    select: {
      finalAmount: true,
      finalCostAmount: true,
      finalMargin: true,
      readyAt: true,
      deliveredAt: true,
      warrantyUntil: true
    }
  });

  assert(repairs.every((row) => Number(row.finalAmount) === 0), "Legacy finalAmount must start at zero");
  assert(repairs.every((row) => Number(row.finalCostAmount) === 0), "Legacy finalCostAmount must start at zero");
  assert(repairs.every((row) => Number(row.finalMargin) === 0), "Legacy finalMargin must start at zero");
  assert(repairs.every((row) => row.readyAt === null && row.deliveredAt === null && row.warrantyUntil === null), "Legacy lifecycle dates must remain null");

  console.log("Completion migration verified: legacy repairs preserved, no test/delivery history invented, closure snapshots initialized safely.");
} finally {
  await prisma.$disconnect();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
