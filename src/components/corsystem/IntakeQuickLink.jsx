"use client";

import { useEffect, useState } from "react";
import styles from "./IntakeQuickLink.module.css";

export default function IntakeQuickLink() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function syncVisibility() {
      const route = window.location.hash.replace(/^#/, "");
      const onRepairArea = route === "/dashboard/repairs" || route.startsWith("/dashboard/repairs/");
      setVisible(window.location.pathname === "/" && onRepairArea);
    }

    syncVisibility();
    window.addEventListener("hashchange", syncVisibility);
    return () => window.removeEventListener("hashchange", syncVisibility);
  }, []);

  if (!visible) return null;

  return (
    <a className={styles.link} href="/intake" aria-label="Apri accettazione CorSystem">
      <span className={styles.plus}>＋</span>
      <span>Accettazione CorSystem</span>
    </a>
  );
}
