import { redirect } from "next/navigation";
import { requireAnyPageAccess } from "@/lib/auth";

export default async function IntakeLayout({ children }) {
  try {
    await requireAnyPageAccess(["repairs", "clients"]);
  } catch (error) {
    if (error?.status === 401) redirect("/#/login");
    redirect("/#/dashboard/repairs");
  }
  return children;
}
