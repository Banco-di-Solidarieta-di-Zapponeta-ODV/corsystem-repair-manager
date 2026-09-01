import RepairPartsClient from "./RepairPartsClient";

export default async function RepairPartsPage({ params }) {
  const { repairId } = await params;
  return <RepairPartsClient repairId={repairId} />;
}
