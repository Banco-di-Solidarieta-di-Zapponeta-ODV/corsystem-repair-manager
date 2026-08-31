import { authErrorResponse, requireAnyPageAccess } from "@/lib/auth";
import {
  dispatchNotification,
  dispatchQueuedNotifications,
  notificationDashboard
} from "@/features/notifications/server";

export async function GET(request) {
  try {
    await requireAnyPageAccess(["repairs", "settings"]);
    const url = new URL(request.url);
    return Response.json(await notificationDashboard(url.searchParams.get("limit") || 100));
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request) {
  try {
    const staff = await requireAnyPageAccess(["repairs", "settings"]);
    const body = await request.json();
    const action = String(body?.action || "").trim();

    if (action === "dispatch-queued") {
      const results = await dispatchQueuedNotifications(body.limit || 25);
      return Response.json({ results });
    }

    if (action === "retry") {
      const id = String(body.notificationId || "").trim();
      if (!id) throwHttpError(400, "Notifica non valida");
      const notification = await dispatchNotification(id, { force: Boolean(staff?.isAdmin) });
      return Response.json({ notification });
    }

    throwHttpError(400, "Azione notifiche non valida");
  } catch (error) {
    return authErrorResponse(error);
  }
}

function throwHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
