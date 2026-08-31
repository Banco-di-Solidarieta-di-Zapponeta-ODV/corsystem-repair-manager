import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const [diagnosisCount, quoteCount, quoteItemCount, linkedRepairs] = await Promise.all([
    prisma.diagnosis.count(),
    prisma.quote.count(),
    prisma.quoteItem.count(),
    prisma.repair.count({ where: { deviceId: { not: null } } })
  ]);

  assert(diagnosisCount === 0, `Expected 0 migrated diagnoses, found ${diagnosisCount}`);
  assert(quoteCount === 2, `Expected 2 legacy quotes from Repair.budget, found ${quoteCount}`);
  assert(quoteItemCount === 2, `Expected 2 legacy quote items, found ${quoteItemCount}`);
  assert(linkedRepairs === 4, `Device migration regression: expected 4 linked repairs, found ${linkedRepairs}`);

  const quotes = await prisma.quote.findMany({
    orderBy: { total: "asc" },
    include: { items: true, repair: { select: { ticket: true, budget: true } } }
  });

  assert(quotes.every((quote) => quote.status === "LEGACY"), "All migrated quotes must use LEGACY status");
  assert(quotes.every((quote) => quote.version === 1), "All migrated quotes must be version 1");
  assert(quotes.every((quote) => quote.items.length === 1), "Each migrated quote must have one legacy item");
  assert(quotes.every((quote) => Number(quote.total) === Number(quote.repair.budget)), "Migrated quote totals must match Repair.budget");

  const totals = quotes.map((quote) => Number(quote.total)).sort((a, b) => a - b);
  assert(totals[0] === 129 && totals[1] === 240, `Unexpected migrated totals: ${totals.join(", ")}`);

  const zeroBudgetQuotes = await prisma.quote.count({
    where: { repair: { budget: 0 } }
  });
  assert(zeroBudgetQuotes === 0, `Expected no quote for zero-budget repairs, found ${zeroBudgetQuotes}`);

  console.log("Workflow migration verified: Diagnosis tables ready, 2 legacy budgets imported as versioned quotes, Device links preserved.");
} finally {
  await prisma.$disconnect();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
