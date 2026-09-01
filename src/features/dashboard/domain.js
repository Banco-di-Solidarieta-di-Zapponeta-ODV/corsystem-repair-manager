export const DASHBOARD_PIPELINE = [
  { key: "ACCETTATO", label: "Accettati" },
  { key: "IN_DIAGNOSI", label: "In diagnosi" },
  { key: "ATTESA_PREVENTIVO", label: "Preventivo" },
  { key: "ATTESA_APPROVAZIONE", label: "Attesa cliente" },
  { key: "AUTORIZZATO", label: "Autorizzati" },
  { key: "ATTESA_RICAMBIO", label: "Attesa ricambio" },
  { key: "IN_LAVORAZIONE", label: "In lavorazione" },
  { key: "IN_TEST", label: "In test" },
  { key: "PRONTO", label: "Pronti" }
];

const LEGACY_STATUS_MAP = {
  "预定": "ACCETTATO",
  "预定到货": "ATTESA_RICAMBIO",
  "预定已到货": "AUTORIZZATO",
  "待开始": "AUTORIZZATO",
  "待检测": "IN_DIAGNOSI",
  "等客户确认": "ATTESA_APPROVAZIONE",
  "维修中": "IN_LAVORAZIONE",
  "完成": "PRONTO",
  "已取走": "CONSEGNATO",
  "取消": "ANNULLATO"
};

export const CLOSED_REPAIR_STATUSES = ["CONSEGNATO", "ANNULLATO", "已取走", "取消"];

export function canonicalRepairStatus(value) {
  const status = String(value || "").trim();
  return LEGACY_STATUS_MAP[status] || status || "ACCETTATO";
}

export function pipelineCounts(repairs = []) {
  const counts = Object.fromEntries(DASHBOARD_PIPELINE.map((item) => [item.key, 0]));
  for (const repair of repairs) {
    const status = canonicalRepairStatus(repair.status);
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
  }
  return DASHBOARD_PIPELINE.map((item) => ({ ...item, count: counts[item.key] || 0 }));
}

export function ageDays(value, now = new Date()) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

export function durationHours(start, end) {
  const from = start ? new Date(start) : null;
  const to = end ? new Date(end) : null;
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return null;
  return (to.getTime() - from.getTime()) / 3600000;
}

export function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

export function technicianLoad(repairs = []) {
  const map = new Map();
  for (const repair of repairs) {
    const key = repair.technicianId || repair.technicianName || "unassigned";
    const label = repair.technicianName || "Non assegnato";
    const current = map.get(key) || {
      id: key,
      name: label,
      total: 0,
      diagnosis: 0,
      waitingPart: 0,
      working: 0,
      testing: 0,
      ready: 0
    };
    const status = canonicalRepairStatus(repair.status);
    current.total += 1;
    if (status === "IN_DIAGNOSI") current.diagnosis += 1;
    if (status === "ATTESA_RICAMBIO") current.waitingPart += 1;
    if (["AUTORIZZATO", "IN_LAVORAZIONE"].includes(status)) current.working += 1;
    if (status === "IN_TEST") current.testing += 1;
    if (status === "PRONTO") current.ready += 1;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "it"));
}

export function operationalAlerts(repairs = [], now = new Date()) {
  const alerts = [];
  for (const repair of repairs) {
    const status = canonicalRepairStatus(repair.status);
    const days = ageDays(repair.readyAt || repair.updatedAt || repair.createdAt, now);
    let severity = 0;
    let reason = "";

    if (status === "PRONTO" && days >= 3) {
      severity = 4;
      reason = `Pronto da ${days} giorni`;
    } else if (status === "ATTESA_RICAMBIO" && days >= 5) {
      severity = 3;
      reason = `Attesa ricambio da ${days} giorni`;
    } else if (status === "ATTESA_APPROVAZIONE" && days >= 3) {
      severity = 3;
      reason = `Preventivo senza risposta da ${days} giorni`;
    } else if (status === "IN_DIAGNOSI" && days >= 2) {
      severity = 2;
      reason = `In diagnosi da ${days} giorni`;
    } else if (status === "ACCETTATO" && days >= 2) {
      severity = 2;
      reason = `Ancora da prendere in carico dopo ${days} giorni`;
    }

    if (severity) alerts.push({ repair, severity, reason, ageDays: days });
  }
  return alerts.sort((a, b) => b.severity - a.severity || b.ageDays - a.ageDays).slice(0, 20);
}
