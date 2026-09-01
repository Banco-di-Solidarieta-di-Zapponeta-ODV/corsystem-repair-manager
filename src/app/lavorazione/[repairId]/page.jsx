import { redirect } from "next/navigation";
import { requireAnyPageAccess } from "@/lib/auth";
import WorkbenchClient from "./WorkbenchClient";

export const metadata = {
  title: "Diagnosi e preventivo | CorSystem Repair Manager"
};

export default async function RepairWorkbenchPage({ params }) {
  try {
    await requireAnyPageAccess(["repairs"]);
  } catch (error) {
    if (error?.status === 401) redirect("/#/login");
    redirect("/#/dashboard/repairs");
  }

  const { repairId } = await params;
  return <WorkbenchClient repairId={repairId} />;
}
