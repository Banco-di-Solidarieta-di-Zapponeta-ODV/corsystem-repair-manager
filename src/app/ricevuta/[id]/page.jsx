import QRCode from "qrcode";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { canAccessPage, getCurrentStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PrintActions from "@/components/corsystem/PrintActions";
import BrandIdentity from "@/components/corsystem/BrandIdentity";
import { COMPANY_PROFILE } from "@/config/corsystem";
import {
  customerStatusUrl,
  deviceDisplayName,
  deviceIdentifier,
  formatItalianDateTime,
  parseIntakeProperties,
  publicBaseUrlFromRequest,
  repairStatusLabel
} from "@/features/intake/receipt";
import styles from "./page.module.css";

export const metadata = {
  title: "Ricevuta di accettazione | CorSystem Repair Manager",
  robots: { index: false, follow: false }
};

export default async function IntakeReceiptPage({ params, searchParams }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/#/login");
  if (!canAccessPage(staff, "repairs")) redirect("/#/dashboard/repairs");

  const { id } = await params;
  const query = await searchParams;
  const format = query?.format === "thermal" ? "thermal" : "a4";

  const [repair, settingRecord] = await Promise.all([
    prisma.repair.findUnique({
      where: { id },
      include: { client: true, device: true }
    }),
    prisma.setting.findUnique({ where: { id: "main" } })
  ]);
  if (!repair) notFound();

  const settings = settingRecord?.value || {};
  const intake = parseIntakeProperties(repair.properties);
  const requestHeaders = await headers();
  const baseUrl = publicBaseUrlFromRequest(settings, requestHeaders);
  const statusUrl = customerStatusUrl(baseUrl, repair.publicToken);
  const qrDataUrl = statusUrl
    ? await QRCode.toDataURL(statusUrl, { errorCorrectionLevel: "M", margin: 1, width: 320 })
    : "";

  const deviceName = deviceDisplayName(repair.device || {}, repair);
  const identifier = deviceIdentifier(repair.device || {}, repair);
  const acceptedAt = intake.acceptedAt || repair.createdAt;
  const isThermal = format === "thermal";

  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <PrintActions repairId={repair.id} publicToken={repair.publicToken} />
      </div>

      <article className={`${styles.sheet} ${isThermal ? styles.thermal : styles.a4}`}>
        <style>{isThermal ? "@page { size: 80mm auto; margin: 4mm; }" : "@page { size: A4; margin: 12mm; }"}</style>

        <header className={styles.header}>
          <BrandIdentity variant="document" showDetails={!isThermal} />
          {isThermal ? (
            <div className={styles.issuer}>
              <div>{COMPANY_PROFILE.address}</div>
              <div>Tel/WhatsApp {COMPANY_PROFILE.phone}</div>
              <div>P.IVA {COMPANY_PROFILE.vatNumber}</div>
            </div>
          ) : null}
        </header>

        <div className={styles.ticketBlock}>
          <div>
            <div className={styles.title}>Ricevuta di accettazione</div>
            <div className={styles.meta}>{formatItalianDateTime(acceptedAt)}</div>
          </div>
          <div>
            <div className={styles.ticket}>{repair.ticket}</div>
            <div className={styles.meta}>Stato: {repairStatusLabel(repair.status)}</div>
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>Cliente</div>
          <div className={styles.grid}>
            <ReceiptRow label="Nome" value={repair.client?.name} />
            <ReceiptRow label="Telefono" value={repair.client?.phone} />
            {!isThermal ? <ReceiptRow label="Email" value={repair.client?.email} /> : null}
            {!isThermal ? <ReceiptRow label="CF / Documento" value={repair.client?.identity} /> : null}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>Dispositivo</div>
          <div className={styles.grid}>
            <ReceiptRow label="Dispositivo" value={deviceName} />
            <ReceiptRow label="Identificativo" value={identifier || "Non indicato"} />
            {repair.device?.color ? <ReceiptRow label="Colore" value={repair.device.color} /> : null}
            {repair.device?.serialNumber && repair.device?.imei ? <ReceiptRow label="S/N" value={repair.device.serialNumber} /> : null}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>Problema segnalato</div>
          <div className={styles.issue}>{repair.issue || "Non specificato"}</div>
        </section>

        {intake.initialCondition.length ? (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Condizioni iniziali</div>
            <ReceiptList items={intake.initialCondition} />
          </section>
        ) : null}

        {intake.accessories.length ? (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Accessori consegnati</div>
            <ReceiptList items={intake.accessories} />
          </section>
        ) : null}

        {intake.notes ? (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Note di accettazione</div>
            <div className={styles.row}>{intake.notes}</div>
          </section>
        ) : null}

        <section className={styles.section}>
          <div className={styles.grid}>
            <ReceiptRow label="Tecnico" value={repair.technicianName || "Da assegnare"} />
            <ReceiptRow label="Foto condizioni" value={repair.frontPhoto || repair.backPhoto ? "Acquisite" : "Non acquisite"} />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.qrArea}>
            <div>
              <div className={styles.sectionTitle}>Segui la riparazione</div>
              <div>Scansiona il QR per controllare lo stato della pratica senza accedere all'area riservata.</div>
              {statusUrl ? <div className={styles.statusUrl}>{statusUrl}</div> : null}
            </div>
            {qrDataUrl ? <img src={qrDataUrl} alt={`QR stato pratica ${repair.ticket}`} /> : null}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>Firma e presa visione</div>
          {repair.signatureDataUrl ? <img className={styles.signature} src={repair.signatureDataUrl} alt="Firma del cliente" /> : <div>Firma non disponibile</div>}
          <div className={styles.terms}>
            Il cliente conferma i dati riportati nella presente accettazione e la presa visione dell'informativa privacy e delle condizioni del servizio. Conservare il numero pratica per il ritiro e per eventuali comunicazioni con il laboratorio.
          </div>
        </section>

        {!isThermal ? (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Nota operativa</div>
            <div className={styles.terms}>
              Il dispositivo viene preso in carico nelle condizioni indicate nella presente ricevuta. Eventuali lavorazioni, ricambi o costi ulteriori saranno gestiti secondo il flusso di diagnosi e preventivazione applicabile alla pratica.
            </div>
          </section>
        ) : null}

        <footer className={styles.footer}>
          {COMPANY_PROFILE.displayName} · P.IVA {COMPANY_PROFILE.vatNumber} · Tel/WhatsApp {COMPANY_PROFILE.phone}<br />
          pratica {repair.ticket} · documento generato da CorSystem Repair Manager
        </footer>
      </article>
    </main>
  );
}

function ReceiptRow({ label, value }) {
  return (
    <div className={styles.row}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{String(value || "-")}</div>
    </div>
  );
}

function ReceiptList({ items }) {
  return <ul className={styles.list}>{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}
