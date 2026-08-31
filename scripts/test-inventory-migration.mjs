import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const parts = await prisma.part.findMany({ orderBy: { defaultName: "asc" } });
  assert(parts.length === 2, `Expected 2 migrated legacy parts, found ${parts.length}`);
  assert(parts.every((part) => String(part.sku || "").startsWith("LEG-")), "Every legacy part must receive a stable LEG-* SKU");
  assert(new Set(parts.map((part) => part.sku)).size === parts.length, "Legacy SKUs must be unique");
  assert(parts.every((part) => Number(part.stockQty) === 0), "Legacy parts must start with zero physical stock");
  assert(parts.every((part) => Number(part.minStock) === 0), "Legacy parts must not receive invented minimum stock");
  assert(parts.every((part) => Number(part.cost) === 0), "Legacy parts must not receive invented cost values");
  assert(parts.every((part) => part.active === true), "Legacy parts must remain active");

  const display = parts.find((part) => part.id === "legacy-part-display");
  const battery = parts.find((part) => part.id === "legacy-part-battery");
  assert(display?.defaultName === "Display OLED Samsung Galaxy S25", "Display legacy name changed during migration");
  assert(Number(display?.price) === 129, "Display legacy sale price changed during migration");
  assert(battery?.defaultName === "Batteria Samsung Galaxy S25", "Battery legacy name changed during migration");
  assert(Number(battery?.price) === 79, "Battery legacy sale price changed during migration");

  const [supplierCount, movementCount, repairPartCount] = await Promise.all([
    prisma.supplier.count(),
    prisma.stockMovement.count(),
    prisma.repairPart.count()
  ]);
  assert(supplierCount === 0, `Migration must not invent suppliers, found ${supplierCount}`);
  assert(movementCount === 0, `Migration must not invent stock movements, found ${movementCount}`);
  assert(repairPartCount === 0, `Migration must not invent repair allocations, found ${repairPartCount}`);

  const linkedQuoteItems = await prisma.quoteItem.count({ where: { partId: { not: null } } });
  assert(linkedQuoteItems === 0, `Legacy quote items must not be guessed against inventory, found ${linkedQuoteItems} links`);

  const supplier = await prisma.supplier.create({
    data: { name: "Fornitore CI", address: "", notes: "" }
  });
  await prisma.part.update({
    where: { id: display.id },
    data: { supplierId: supplier.id, cost: 52.5, stockQty: 3, minStock: 1, location: "A-01" }
  });
  const movement = await prisma.stockMovement.create({
    data: {
      partId: display.id,
      type: "RECEIVE",
      quantity: 3,
      stockBefore: 0,
      stockAfter: 3,
      unitCost: 52.5,
      reference: "CI-LOAD",
      note: "CI warehouse schema check",
      createdBy: "CorSystem CI"
    }
  });
  assert(movement.partId === display.id, "Stock movement relation to Part failed");

  const repair = await prisma.repair.findUnique({ where: { id: "repair-imei-1" } });
  const allocation = await prisma.repairPart.create({
    data: {
      repairId: repair.id,
      partId: display.id,
      status: "RESERVED",
      qtyRequested: 1,
      qtyReserved: 1,
      unitCostSnapshot: 52.5,
      notes: "CI reservation"
    }
  });
  assert(allocation.repairId === repair.id && allocation.partId === display.id, "RepairPart relations failed");

  console.log("Inventory migration verified: 2 legacy parts preserved, zero invented stock, warehouse relations operational.");
} finally {
  await prisma.$disconnect();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
