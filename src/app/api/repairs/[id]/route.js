import { authErrorResponse, requireAnyPageAccess } from "@/lib/auth";
import { deleteRepairRecord, getRepairById, saveRepairRecord } from "@/lib/data-store";
import { prisma } from "@/lib/prisma";
import { ensureDeviceForRepair } from "@/features/devices/server";

export async function GET(_request, { params }) {
  try {
    await requireAnyPageAccess(["repairs", "warranties"]);
    const { id } = await params;
    const [repair, relation] = await Promise.all([
      getRepairById(id),
      prisma.repair.findUnique({ where: { id }, select: { deviceId: true } })
    ]);
    if (!repair) return Response.json({ error: "Riparazione non trovata" }, { status: 404 });
    return Response.json({ repair: { ...repair, deviceId: relation?.deviceId || "" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request, { params }) {
  try {
    const staff = await requireAnyPageAccess(["repairs", "warranties"]);
    const { id } = await params;
    const body = await request.json();
    const repair = { ...(body.repair || {}), id };

    const saved = await saveRepairRecord({ repair, client: body.client || null, actor: { isAdmin: staff.isAdmin } });
    const device = await ensureDeviceForRepair(prisma, { ...repair, clientId: saved.repair?.clientId || repair.clientId });

    if (device) {
      await prisma.repair.update({ where: { id }, data: { deviceId: device.id } });
    }

    return Response.json({
      ...saved,
      repair: { ...saved.repair, deviceId: device?.id || saved.repair?.deviceId || "" },
      device: device || null
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(_request, { params }) {
  try {
    await requireAnyPageAccess(["repairs", "warranties"]);
    const { id } = await params;
    return Response.json(await deleteRepairRecord(id));
  } catch (error) {
    return authErrorResponse(error);
  }
}
