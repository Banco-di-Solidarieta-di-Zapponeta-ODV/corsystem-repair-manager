import { legacyDeviceKey, normalizeImei } from "./domain";

export function projectLegacyDevices(repairs = []) {
  const devices = new Map();

  for (const repair of repairs) {
    if (!repair?.clientId) continue;
    const key = legacyDeviceKey(repair);
    const current = devices.get(key);
    const createdAt = repair.createdAt || null;
    const updatedAt = repair.updatedAt || createdAt;

    const projected = {
      id: key,
      clientId: repair.clientId,
      type: "Smartphone",
      brand: String(repair.brand || "").trim(),
      model: String(repair.model || "").trim(),
      imei: normalizeImei(repair.imei),
      serialNumber: "",
      repairCount: 1,
      firstSeenAt: createdAt,
      lastSeenAt: updatedAt,
      lastRepairId: repair.id,
      legacy: true
    };

    if (!current) {
      devices.set(key, projected);
      continue;
    }

    current.repairCount += 1;
    if (updatedAt && (!current.lastSeenAt || new Date(updatedAt) > new Date(current.lastSeenAt))) {
      current.lastSeenAt = updatedAt;
      current.lastRepairId = repair.id;
    }
    if (createdAt && (!current.firstSeenAt || new Date(createdAt) < new Date(current.firstSeenAt))) {
      current.firstSeenAt = createdAt;
    }
  }

  return [...devices.values()].sort((a, b) => {
    const right = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    const left = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    return right - left;
  });
}
