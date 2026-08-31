"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const ROLE_INFO = {
  ADMIN: {
    label: "Amministratore",
    note: "Accesso completo a operatività, economia, configurazione e operatori.",
    areas: ["Tutto il gestionale", "Economia e margini", "Operatori e ruoli", "Impostazioni e backup"]
  },
  FRONT_OFFICE: {
    label: "Front Office",
    note: "Gestisce il rapporto con il cliente dall'accettazione alla consegna.",
    areas: ["Clienti e dispositivi", "Accettazione", "Preventivi", "Pagamenti e consegna", "Notifiche"]
  },
  TECHNICIAN: {
    label: "Tecnico",
    note: "Lavora sulla pratica tecnica senza accesso ai dati economici generali.",
    areas: ["Pratiche", "Diagnosi", "Preventivi tecnici", "Ricambi pratica", "Test finale"]
  },
  INVENTORY: {
    label: "Magazzino",
    note: "Gestisce ricambi, fornitori, giacenze e richieste collegate alle pratiche.",
    areas: ["Magazzino", "Fornitori", "Movimenti", "Ricambi pratica"]
  },
  CUSTOM: {
    label: "Personalizzato legacy",
    note: "Compatibilità con i vecchi account RepairNOTE. Mantiene i permessi pagina già assegnati.",
    areas: ["Permessi legacy conservati"]
  }
};

const EMPTY = { id: "", name: "", username: "", email: "", role: "FRONT_OFFICE", password: "" };

export default function OperatorsPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/staff?meta=1", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Impossibile caricare gli operatori");
      setUsers(payload.users || []);
      setRoles(payload.roles || []);
    } catch (err) {
      setError(err.message || "Errore durante il caricamento");
    } finally {
      setLoading(false);
    }
  }

  function edit(user) {
    setNotice("");
    setError("");
    setForm({
      id: user.id,
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      role: user.role || (user.isAdmin ? "ADMIN" : "CUSTOM"),
      password: ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setForm(EMPTY);
    setError("");
    setNotice("");
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Salvataggio non riuscito");
      setUsers(payload.users || []);
      setNotice(form.id ? "Operatore aggiornato." : "Operatore creato.");
      setForm(EMPTY);
    } catch (err) {
      setError(err.message || "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  async function remove(user) {
    if (!window.confirm(`Eliminare l'operatore ${user.name}?`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Eliminazione non riuscita");
      setUsers(payload.users || []);
      if (form.id === user.id) setForm(EMPTY);
      setNotice("Operatore eliminato.");
    } catch (err) {
      setError(err.message || "Eliminazione non riuscita");
    } finally {
      setSaving(false);
    }
  }

  const roleOptions = useMemo(() => {
    const available = roles.length ? roles : Object.keys(ROLE_INFO).map((role) => ({ role, label: ROLE_INFO[role].label }));
    return available;
  }, [roles]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>CorSystem Repair Manager</div>
            <h1>Operatori e ruoli</h1>
            <p>Assegna un profilo operativo chiaro. Le autorizzazioni vengono applicate anche lato server.</p>
          </div>
          <div className={styles.headerActions}>
            <a href="/dashboard-operativo">Dashboard</a>
            <a href="/#/dashboard/repairs">Riparazioni</a>
          </div>
        </header>

        {error ? <div className={styles.error}>{error}</div> : null}
        {notice ? <div className={styles.notice}>{notice}</div> : null}

        <section className={styles.roleGrid}>
          {["ADMIN", "FRONT_OFFICE", "TECHNICIAN", "INVENTORY"].map((role) => (
            <article className={styles.roleCard} key={role}>
              <strong>{ROLE_INFO[role].label}</strong>
              <p>{ROLE_INFO[role].note}</p>
              <div>{ROLE_INFO[role].areas.map((area) => <span key={area}>{area}</span>)}</div>
            </article>
          ))}
        </section>

        <div className={styles.columns}>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <div><h2>{form.id ? "Modifica operatore" : "Nuovo operatore"}</h2><p>{form.id ? "La password vuota mantiene quella attuale." : "Per un nuovo account la password è obbligatoria."}</p></div>
              {form.id ? <button type="button" className={styles.textButton} onClick={reset}>Nuovo</button> : null}
            </div>
            <form onSubmit={save} className={styles.form}>
              <label>Nome e cognome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Nome utente<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
              <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label>Ruolo<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roleOptions.map((item) => <option key={item.role} value={item.role}>{item.label}</option>)}</select></label>
              <label className={styles.full}>{form.id ? "Nuova password, facoltativa" : "Password"}<input type="password" required={!form.id} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
              <div className={`${styles.roleHint} ${styles.full}`}>
                <strong>{ROLE_INFO[form.role]?.label || form.role}</strong>
                <span>{ROLE_INFO[form.role]?.note || "Profilo operatore"}</span>
              </div>
              <button className={`${styles.primary} ${styles.full}`} disabled={saving}>{saving ? "Salvataggio…" : form.id ? "Salva modifiche" : "Crea operatore"}</button>
            </form>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><div><h2>Operatori attivi</h2><p>{users.length} account configurati.</p></div></div>
            {loading ? <div className={styles.empty}>Caricamento…</div> : users.length ? (
              <div className={styles.userList}>
                {users.map((user) => (
                  <article className={styles.userRow} key={user.id}>
                    <div className={styles.avatar}>{initials(user.name)}</div>
                    <div className={styles.userMain}>
                      <div><strong>{user.name}</strong><span className={styles.badge}>{user.roleLabel || ROLE_INFO[user.role]?.label || user.role}</span></div>
                      <span>@{user.username}{user.email ? ` · ${user.email}` : ""}</span>
                      {user.role === "CUSTOM" ? <small>Account legacy: permessi pagina conservati.</small> : null}
                    </div>
                    <div className={styles.rowActions}>
                      <button type="button" onClick={() => edit(user)}>Modifica</button>
                      <button type="button" className={styles.danger} onClick={() => remove(user)} disabled={saving}>Elimina</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <div className={styles.empty}>Nessun operatore configurato.</div>}
          </section>
        </div>
      </div>
    </main>
  );
}

function initials(name) {
  return String(name || "CS").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CS";
}
