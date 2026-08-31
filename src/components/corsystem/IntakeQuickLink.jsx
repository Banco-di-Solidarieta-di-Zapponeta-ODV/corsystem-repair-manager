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
        <div className={styles.printActions}>
          <a href={`/ricevuta/${encodeURIComponent(state.repairId)}?format=a4`} target="_blank" rel="noreferrer">A4</a>
          <a href={`/ricevuta/${encodeURIComponent(state.repairId)}?format=thermal`} target="_blank" rel="noreferrer">80 mm</a>
        </div>
      ) : null}
      <a className={styles.link} href="/intake" aria-label="Apri accettazione CorSystem">
        <span className={styles.plus}>＋</span>
        <span>Accettazione CorSystem</span>
      </a>
    </div>
  );
}
