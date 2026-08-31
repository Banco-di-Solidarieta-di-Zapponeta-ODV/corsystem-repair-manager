"use client";

import { useEffect, useState } from "react";
import styles from "./IntakeQuickLink.module.css";

export default function IntakeQuickLink() {
  const [state, setState] = useState({ visible: false, repairId: "" });

  useEffect(() => {
    function syncVisibility() {
      const route = window.location.hash.replace(/^#/, "");
      const onRepairArea = route === "/dashboard/repairs" || route.startsWith("/dashboard/repairs/");
      const detailMatch = route.match(/^\/dashboard\/repairs\/([^/]+)$/);
      const candidateId = detailMatch?.[1] && detailMatch[1] !== "new" ? decodeURIComponent(detailMatch[1]) : "";
      setState({
        visible: window.location.pathname === "/" && onRepairArea,
        repairId: candidateId
      });
    }

    syncVisibility();
    window.addEventListener("hashchange", syncVisibility);
    return () => window.removeEventListener("hashchange", syncVisibility);
  }, []);

  if (!state.visible) return null;

  return (
    <div className={styles.stack}>
      {state.repairId ? (
        <>
          <div className={styles.printActions}>
            <a href={`/ricevuta/${encodeURIComponent(state.repairId)}?format=a4`} target="_blank" rel="noreferrer">A4</a>
            <a href={`/ricevuta/${encodeURIComponent(state.repairId)}?format=thermal`} target="_blank" rel="noreferrer">80 mm</a>
          </div>
          <a className={styles.closeLink} href={`/chiusura/${encodeURIComponent(state.repairId)}`} aria-label="Apri test finale pagamento e consegna">Test / Consegna</a>
          <a className={styles.partsLink} href={`/magazzino/pratica/${encodeURIComponent(state.repairId)}`} aria-label="Apri ricambi della pratica">Ricambi pratica</a>
          <a className={styles.workLink} href={`/lavorazione/${encodeURIComponent(state.repairId)}`} aria-label="Apri diagnosi e preventivo CorSystem">Diagnosi / Preventivo</a>
        </>
      ) : null}
      <a className={styles.notificationLink} href="/notifiche" aria-label="Apri console notifiche CorSystem">Notifiche</a>
      <a className={styles.warehouseLink} href="/magazzino" aria-label="Apri magazzino ricambi CorSystem">Magazzino</a>
      <a className={styles.deviceLink} href="/dispositivi" aria-label="Apri archivio dispositivi CorSystem">Dispositivi</a>
      <a className={styles.link} href="/intake" aria-label="Apri accettazione CorSystem">
        <span className={styles.plus}>＋</span>
        <span>Accettazione CorSystem</span>
      </a>
    </div>
  );
}
