import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const devices = await prisma.device.findMany({ orderBy: { clientId: "asc" } });
  const repairs = await prisma.repair.findMany({
    where: { id: { in: ["repair-imei-1", "repair-imei-2", "repair-legacy-1", "repair-legacy-2"] } },
    select: { id: true, clientId: true, deviceId: true, imei: true },
    orderBy: { id: "asc" }
  });

  assert(devices.length === 2, `Attesi 2 dispositivi dal backfill, trovati ${devices.length}`);
  assert(repairs.length === 4, `Attese 4 riparazioni fixture, trovate ${repairs.length}`);
  assert(repairs.every((repair) => Boolean(repair.deviceId)), "Ogni riparazione legacy deve avere deviceId dopo la migrazione");

  const imeiRepairs = repairs.filter((repair) => repair.clientId === "client-imei");
  const legacyRepairs = repairs.filter((repair) => repair.clientId === "client-legacy");

  assert(imeiRepairs.length === 2, "Fixture IMEI incompleta");
  assert(legacyRepairs.length === 2, "Fixture legacy incompleta");
  assert(imeiRepairs[0].deviceId === imeiRepairs[1].deviceId, "Le riparazioni con lo stesso IMEI devono convergere sullo stesso Device");
  assert(legacyRepairs[0].deviceId === legacyRepairs[1].deviceId, "Le riparazioni legacy equivalenti devono convergere sullo stesso Device");
  assert(imeiRepairs[0].deviceId !== legacyRepairs[0].deviceId, "Clienti/dispositivi diversi non devono essere fusi");

  const imeiDevice = devices.find((device) => device.clientId === "client-imei");
  const legacyDevice = devices.find((device) => device.clientId === "client-legacy");

  assert(imeiDevice?.imei === "123456789012345", "L'IMEI deve essere preservato nel Device");
  assert(legacyDevice?.brand === "Apple" && legacyDevice?.model === "MacBook Air M2", "Marca e modello legacy devono essere preservati");

  console.log("Device migration backfill OK", {
    devices: devices.length,
    repairs: repairs.length,
    imeiDeviceId: imeiDevice.id,
    legacyDeviceId: legacyDevice.id
  });
} finally {
  await prisma.$disconnect();
}
