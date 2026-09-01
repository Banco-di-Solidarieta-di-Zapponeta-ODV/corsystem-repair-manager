import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  deviceDisplayName,
  deviceIdentifier,
  formatItalianDateTime,
  normalizeRepairStatus,
  repairStatusLabel
} from "@/features/intake/receipt";
import styles from "../devices.module.css";

export const metadata = {
  title: "Scheda dispositivo | CorSystem Repair Manager"
};

export default async function DeviceDetailPage({ params }) {
  const { id } = await params;
  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      client: true,
      repairs: {
        orderBy: { updatedAt: "desc" },
        include: { payments: true }
      }
    }
  });

  if (!device) notFound();

  const repairs = device.repairs || [];
  const totalBudget = repairs.reduce((sum, repair) => sum + Number(repair.budget || 0), 0);
  const totalPaid = repairs.reduce((sum, repair) => sum + paidAmount(repair), 0);
  const openRepairs = repairs.filter((repair) => !["CONSEGNATO", "ANNULLATO"].includes(normalizeRepairStatus(repair.status))).length;
  const warrantyRepairs = repairs.filter((repair) => repair.orderType === "warranty" || Boolean(repair.sourceRepairId)).length;
  const firstRepair = repairs.length ? repairs[repairs.length - 1] : null;
  const lastRepair = repairs[0] || null;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link className={styles.back} href="/dispositivi">← Tutti i dispositivi</Link>

        <header className={styles.topbar}>
          <div>
            <div className={styles.eyebrow}>Scheda dispositivo CorSystem</div>
            <h1 className={styles.title}>{deviceDisplayName(device)}</h1>
          </div>
          <div className={styles.topActions}>
            <Link className={styles.buttonGhost} href="/#/dashboard/repairs">Riparazioni</Link>
            <Link className={styles.button} href="/intake">＋ Nuova accettazione</Link>
          </div>
        </header>

        <section className={styles.hero}>
          <h2 className={styles.heroTitle}>{device.brand} {device.model}</h2>
          <div className={styles.muted}>{device.type || "Altro"}{device.color ? ` · ${device.color}` : ""}</div>
          <div className={styles.heroGrid}>
            <Info label="Proprietario" value={device.client?.name} />
            <Info label="Telefono" value={device.client?.phone || "-"} />
            <Info label="Email" value={device.client?.email || "-"} />
            <Info label="IMEI / seriale" value={deviceIdentifier(device) || "-"} />
            <Info label="Primo ingresso" value={firstRepair ? formatItalianDateTime(firstRepair.createdAt) : "-"} />
            <Info label="Ultimo aggiornamento" value={lastRepair ? formatItalianDateTime(lastRepair.updatedAt) : formatItalianDateTime(device.updatedAt)} />
          </div>
        </section>

        <section className={styles.metrics}>
          <Metric value={repairs.length} label="Interventi totali" />
          <Metric value={openRepairs} label="Pratiche aperte" />
          <Metric value={money(totalPaid)} label="Incassato storico" />
          <Metric value={warrantyRepairs} label="Garanzie / rientri" />
        </section>

        {device.notes ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Note dispositivo</h2>
            <div className={styles.notes}>{device.notes}</div>
          </section>
        ) : null}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Storico interventi</h2>
          {repairs.length ? repairs.map((repair) => (
            <article className={styles.repair} key={repair.id}>
              <div className={styles.repairHead}>
                <div>
                  <div className={styles.ticket}>{repair.ticket}</div>
                  <div className={styles.muted}>{formatItalianDateTime(repair.createdAt)}</div>
                </div>
                <span className={styles.pill}>{repairStatusLabel(repair.status)}</span>
              </div>

              <div className={styles.repairIssue}>{repair.issue || "Nessuna descrizione dell’intervento."}</div>

              <div className={styles.repairMeta}>
                <span className={styles.pill}>Tecnico: {repair.technicianName || "Da assegnare"}</span>
                <span className={styles.pill}>Preventivato: {money(repair.budget)}</span>
                <span className={styles.pill}>Incassato: {money(paidAmount(repair))}</span>
                {repair.orderType === "warranty" || repair.sourceRepairId ? <span className={styles.pill}>Garanzia / rientro</span> : null}
                {repair.warrantyStart ? <span className={styles.pill}>Garanzia dal {repair.warrantyStart}</span> : null}
              </div>

              <div className={styles.repairActions}>
                <Link href={`/#/dashboard/repairs/${encodeURIComponent(repair.id)}`}>Apri pratica</Link>
                <Link href={`/ricevuta/${encodeURIComponent(repair.id)}?format=a4`} target="_blank">Ricevuta A4</Link>
                <Link href={`/ricevuta/${encodeURIComponent(repair.id)}?format=thermal`} target="_blank">80 mm</Link>
                {repair.publicToken ? <Link href={`/stato/${encodeURIComponent(repair.publicToken)}`} target="_blank">Vista cliente</Link> : null}
              </div>
            </article>
          )) : (
            <div className={styles.empty}>Nessun intervento collegato a questo dispositivo.</div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Riepilogo economico</h2>
          <div className={styles.heroGrid}>
            <Info label="Valore preventivato storico" value={money(totalBudget)} />
            <Info label="Totale incassato" value={money(totalPaid)} />
            <Info label="Interventi" value={String(repairs.length)} />
          </div>
        </section>
      </div>
    </main>
  );
}

function paidAmount(repair) {
  const payments = Array.isArray(repair.payments) ? repair.payments : [];
  if (payments.length) return payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return Number(repair.deposit || 0);
}

function money(value) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function Info({ label, value }) {
  return <div><div className={styles.label}>{label}</div><div className={styles.value}>{value || "-"}</div></div>;
}

function Metric({ value, label }) {
  return <div className={styles.metric}><div className={styles.metricValue}>{value}</div><div className={styles.metricLabel}>{label}</div></div>;
}
