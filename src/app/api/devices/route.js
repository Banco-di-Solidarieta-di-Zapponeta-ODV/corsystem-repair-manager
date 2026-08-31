import { requireAnyPageAccess, authErrorResponse } from "@/lib/auth";
import { getBootstrapData } from "@/lib/data-store";
import { projectLegacyDevices } from "@/features/devices/legacy-projection";

export async function GET(request) {
  try {
    await requireAnyPageAccess(["clients", "repairs"]);
    const { searchParams } = new URL(request.url);
    const clientId = String(searchParams.get("clientId") || "").trim();
    const data = await getBootstrapData();
    const devices = projectLegacyDevices(data.repairs || []);
    return Response.json(clientId ? devices.filter((device) => device.clientId === clientId) : devices);
  } catch (error) {
    return authErrorResponse(error);
  }
}
