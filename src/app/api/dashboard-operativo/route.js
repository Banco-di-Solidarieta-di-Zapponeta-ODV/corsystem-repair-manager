import { authErrorResponse, hasCapability, requireCapability } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES } from "@/features/access/roles";
import {
  CLOSED_REPAIR_STATUSES,
  canonicalRepairStatus,
  durationHours,
  money,
  operationalAlerts,
  pipelineCounts,
  technicianLoad
} from "@/features/dashboard/domain";

export async function GET() {
  try {
    const staff = await requireCapability(CAPABILITIES.DASHBOARD_VIEW);
    const canSeeFinance = hasCapability(staff, CAPABILITIES.DASHBOARD_FINANCE);
    const canSeeInventory = hasCapability(staff, CAPABILITIES.INVENTORY_VIEW);
    const canSeeNotifications = hasCapability(staff, CAPABILITIES.NOTIFICATIONS_VIEW);

    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 86400000);
    const last90Days = new Date(now.getTime() - 90 * 86400000);

    const [openRepairs, pendingQuotes, payments30d, delivered30d, delivered90d, activeParts, failedNotifications] = await Promise.all([
      prisma.repair.findMany({
        where: { status: { notIn: CLOSED_REPAIR_STATUSES } },
        orderBy: [{ updatedAt: "asc" }],
        select: {
          id: true,
          ticket: true,
          status: true,
          technicianId: true,
          technicianName: true,
          readyAt: true,
          createdAt: true,
          updatedAt: true,
          client: { select: { name: true, phone: true } },
          device: { select: { brand: true, model: true, type: true } }
        }
      }),
      prisma.quote.count({ where: { status: "SENT" } }),
      canSeeFinance
        ? prisma.payment.aggregate({ where: { paidAt: { gte: last30Days } }, _sum: { amount: true }, _count: { _all: true } })
        : Promise.resolve({ _sum: { amount: 0 }, _count: { _all: 0 } }),
      canSeeFinance
        ? prisma.repair.findMany({
            where: { deliveredAt: { gte: last30Days } },
            select: { finalAmount: true, finalCostAmount: true, finalMargin: true }
          })
        : Promise.resolve([]),
      canSeeFinance
        ? prisma.repair.findMany({
            where: { deliveredAt: { gte: last90Days } },
            select: { createdAt: true, deliveredAt: true }
          })
        : Promise.resolve([]),
      canSeeInventory
        ? prisma.part.findMany({
            where: { active: true },
            select: {
              id: true,
              defaultName: true,
              sku: true,
              stockQty: true,
              minStock: true,
              location: true,
              supplier: { select: { name: true } }
            }
          })
        : Promise.resolve([]),
      canSeeNotifications ? prisma.notification.count({ where: { status: "FAILED" } }) : Promise.resolve(0)
    ]);

    const pipeline = pipelineCounts(openRepairs);
    const pipelineMap = Object.fromEntries(pipeline.map((item) => [item.key, item.count]));
    const alerts = operationalAlerts(openRepairs, now).map(({ repair, severity, reason, ageDays }) => ({
      id: repair.id,
      ticket: repair.ticket,
      status: canonicalRepairStatus(repair.status),
      severity,
      reason,
      ageDays,
      clientName: repair.client?.name || "Cliente",
      device: [repair.device?.brand || repair.device?.type, repair.device?.model].filter(Boolean).join(" ") || "Dispositivo",
      technicianName: repair.technicianName || "Non assegnato"
    }));

    const lowStockAll = activeParts
      .map((part) => ({
        id: part.id,
        name: part.defaultName,
        sku: part.sku || "",
        stockQty: Number(part.stockQty || 0),
        minStock: Number(part.minStock || 0),
        location: part.location || "",
        supplierName: part.supplier?.name || ""
      }))
      .filter((part) => part.minStock > 0 && part.stockQty <= part.minStock)
      .sort((a, b) => (a.stockQty - a.minStock) - (b.stockQty - b.minStock) || a.name.localeCompare(b.name, "it"));

    const deliveredValue = money(delivered30d.reduce((sum, row) => sum + Number(row.finalAmount || 0), 0));
    const deliveredCost = money(delivered30d.reduce((sum, row) => sum + Number(row.finalCostAmount || 0), 0));
    const deliveredMargin = money(delivered30d.reduce((sum, row) => sum + Number(row.finalMargin || 0), 0));
    const turnaroundHours = delivered90d.map((row) => durationHours(row.createdAt, row.deliveredAt)).filter((value) => value !== null);
    const averageTurnaroundHours = turnaroundHours.length
      ? Math.round((turnaroundHours.reduce((sum, value) => sum + value, 0) / turnaroundHours.length) * 10) / 10
      : 0;

    const readyCount = pipelineMap.PRONTO || 0;
    const overdueReady = alerts.filter((item) => item.status === "PRONTO").length;
    const unassigned = openRepairs.filter((repair) => !repair.technicianId && !repair.technicianName).length;

    return Response.json({
      generatedAt: now.toISOString(),
      role: staff.role,
      visibility: {
        finance: canSeeFinance,
        inventory: canSeeInventory,
        notifications: canSeeNotifications
      },
      kpis: {
        openRepairs: openRepairs.length,
        pendingQuotes,
        waitingPart: pipelineMap.ATTESA_RICAMBIO || 0,
        ready: readyCount,
        overdueReady,
        unassigned,
        failedNotifications: canSeeNotifications ? failedNotifications : null,
        lowStock: canSeeInventory ? lowStockAll.length : null
      },
      pipeline,
      technicians: technicianLoad(openRepairs),
      financial30d: canSeeFinance
        ? {
            payments: money(payments30d._sum.amount),
            paymentMovements: payments30d._count._all,
            deliveredValue,
            deliveredCost,
            margin: deliveredMargin,
            deliveries: delivered30d.length,
            averageTicket: delivered30d.length ? money(deliveredValue / delivered30d.length) : 0,
            averageTurnaroundHours
          }
        : null,
      alerts,
      lowStock: canSeeInventory ? lowStockAll.slice(0, 20) : []
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
