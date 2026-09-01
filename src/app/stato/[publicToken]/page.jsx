import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BrandIdentity from "@/components/corsystem/BrandIdentity";
import { COMPANY_PROFILE, companyPhoneHref } from "@/config/corsystem";
import {
  CUSTOMER_PROGRESS_STEPS,
  customerProgress,
  deviceDisplayName,
  deviceIdentifier,
  formatItalianDateTime,
  maskCustomerName,
  repairStatusLabel
} from "@/features/intake/receipt";
import styles from "./page.module.css";

export const metadata = {
  title: "Stato riparazione | CorSystem",
  robots: { index: false, follow: false, nocache: true }
};

export default async function CustomerRepairStatusPage({ params }) {
  const { publicToken } = await params;
  const repair = await prisma.repair.findUnique({
    where: { publicToken },
    include: {
      client: true,
      device: true
    }
  });

  if (!repair) notFound();

  const statusLabel = repairStatusLabel(repair.status);
  const progress = customerProgress(repair.status);
  const deviceName = deviceDisplayName(repair.device || {}, repair);
  const identifier = maskPublicIdentifier(deviceIdentifier(repair.device || {}, repair));
  const hint = customerHint(progress.key, progress.cancelled);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <BrandIdentity variant="public" />
          <h1 className={styles.title}>Stato della riparazione</h1>
          <div className={styles.ticket}>{repair.ticket}</div>

          <div className={styles.statusLine}>
            <div className={styles.statusLabel}>{progress.cancelled ? "Pratica annullata" : statusLabel}</div>
            <div className={styles.updated}>Aggiornato il {formatItalianDateTime(repair.updatedAt)}</div>
          </div>

          <div className={styles.progressTrack} aria-label={`Avanzamento ${progress.percent}%`}>
            <div
              className={`${styles.progressBar} ${progress.cancelled ? styles.cancelled : ""}`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          {!progress.cancelled ? (
            <div className={styles.steps}>
              {CUSTOMER_PROGRESS_STEPS.map((step, index) => (
                <div key={step.key} className={index <= progress.index ? styles.stepActive : ""}>{step.label}</div>
              ))}
            </div>
          ) : null}
        </header>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Pratica</h2>
          <div className={styles.grid}>
            <StatusField label="Cliente" value={maskCustomerName(repair.client?.name)} />
            <StatusField label="Dispositivo" value={deviceName} />
            {identifier ? <StatusField label="Identificativo" value={identifier} /> : null}
            <StatusField label="Tecnico" value={repair.technicianName || "Da assegnare"} />
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Problema segnalato</h2>
          <div className={styles.issue}>{repair.issue || "Nessuna descrizione disponibile."}</div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Aggiornamento</h2>
          <div className={styles.hint}>{hint}</div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Contatti CorSystem</h2>
          <div className={styles.contact}>
            <a href={companyPhoneHref()}>Tel/WhatsApp {COMPANY_PROFILE.phone}</a>
            <span>{COMPANY_PROFILE.address}</span>
            <span>P.IVA {COMPANY_PROFILE.vatNumber}</span>
            <span>{COMPANY_PROFILE.email}</span>
          </div>
        </section>

        <footer className={styles.footer}>
          Per assistenza comunica sempre il numero pratica {repair.ticket}.<br />
          {COMPANY_PROFILE.displayName} · stato consultabile tramite codice personale della pratica.
        </footer>
      </div>
    </main>
  );
}

function StatusField({ label, value }) {
  return (
    <div>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{String(value || "-")}</div>
    </div>
  );
}

function maskPublicIdentifier(identifier) {
  const value = String(identifier || "").trim();
  if (!value) return "";
  const prefix = value.startsWith("IMEI ") ? "IMEI" : value.startsWith("S/N ") ? "S/N" : "ID";
  const raw = value.replace(/^(IMEI|S\/N)\s+/i, "");
  if (!raw) return "";
  const tail = raw.slice(-4);
  return `${prefix} ••••${tail}`;
}

function customerHint(key, cancelled) {
  if (cancelled) return "La pratica risulta annullata. Contatta CorSystem indicando il numero pratica se hai bisogno di chiarimenti.";
  const hints = {
    PRESA_IN_CARICO: "Il dispositivo è stato registrato ed è in carico al laboratorio. Lo stato verrà aggiornato quando inizieranno le verifiche tecniche.",
    VALUTAZIONE: "Il dispositivo è in fase di verifica oppure in attesa di una decisione necessaria per procedere, come preventivo, approvazione o ricambio.",
    LAVORAZIONE: "Il laboratorio sta lavorando sul dispositivo.",
    CONTROLLO: "La lavorazione principale è terminata e il dispositivo è in fase di controllo e test finale.",
    PRONTO: "Il dispositivo risulta pronto per il ritiro. Contatta CorSystem se hai bisogno di concordare la consegna.",
    CONSEGNATO: "La pratica risulta conclusa e il dispositivo è stato consegnato."
  };
  return hints[key] || hints.PRESA_IN_CARICO;
}
