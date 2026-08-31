import { redirect } from "next/navigation";
import { requireAnyPageAccess } from "@/lib/auth";

export const metadata = {
  title: "Magazzino ricambi | CorSystem Repair Manager"
};

export default async function WarehouseLayout({ children }) {
  try {
    await requireAnyPageAccess(["repairs"]);
  } catch (error) {
    if (error?.status === 401) redirect("/#/login");
    redirect("/#/dashboard/repairs");
  }
  return children;
}
