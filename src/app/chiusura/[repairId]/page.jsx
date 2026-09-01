import { redirect } from "next/navigation";
import { requireAnyPageAccess } from "@/lib/auth";
import ClosureClient from "./ClosureClient";

export const metadata = {
  title: "Test, pagamento e consegna | CorSystem Repair Manager"
};

export default async function ClosurePage({ params }) {
  try {
    await requireAnyPageAccess(["repairs", "finance"]);
  } catch (error) {
    if (error?.status === 401) redirect("/#/login");
    redirect("/#/dashboard/repairs");
  }
  const { repairId } = await params;
  return <ClosureClient repairId={repairId} />;
}
