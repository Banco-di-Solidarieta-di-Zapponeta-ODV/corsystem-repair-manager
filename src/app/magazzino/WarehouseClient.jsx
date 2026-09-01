"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./warehouse.module.css";

const EMPTY_PART = { id: "", defaultName: "", category: "", sku: "", barcode: "", supplierId: "", price: 0, cost: 0, minStock: 0, location: "", active: true };
const EMPTY_SUPPLIER = { id: "", name: "", vatNumber: "", taxCode: "", email: "", phone: "", address: "", website: "", notes: "", active: true };
const EMPTY_MOVE = { partId: "", type: "RECEIVE", quantity: 1, targetStock: 0, unitCost: 0, reference: "", note: "" };

export default function WarehouseClient() {
  const [data, setData] = useState({ parts: [], suppliers: [], recentMovements: [] });
  const [query, setQuery] = useState("");
  const [part, setPart] = useState(EMPTY_PART);
  const [supplier, setSupplier] = useState(EMPTY_SUPPLIER);
  const [movement, setMovement] = useState(EMPTY_MOVE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.parts;
    return data.parts.filter((item) => [item.defaultName, item.category, item.sku, item.barcode, item.location, item.supplier?.name]
      .some((value) => String(value || "").toLowerCase().includes(q)));
  }, [data.parts, query]);

  const lowStock = data.parts.filter((item) => item.lowStock).length;
  const totalValue = data.parts.reduce((sum, item) => sum + Number(item.stockQty || 0) * Number(item.cost || 0), 0);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/inventory", { credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossibile caricare il magazzino");
      setData(payload);
    } catch (err) {
      setError(err.message || "Errore caricamento magazzino");
    } finally {
      setLoading(false);
    }
  }

  async function post(body, success) {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/inventory", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Operazione non riuscita");
      setNotice(success);
      await load();
      return payload;
    } catch (err) {
      setError(err.message || "Errore durante il salvataggio");
      return null;
    } finally { setSaving(false); }
  }

  async function savePart(event) {
    event.preventDefault();
    const result = await post({ action: "part-save", part }, part.id ? "Ricambio aggiornato." : "Ricambio creato.");
    if (result) setPart(EMPTY_PART);
  }

  async function saveSupplier(event) {
    event.preventDefault();
    const result = await post({ action: "supplier-save", supplier }, supplier.id ? "Fornitore aggiornato." : "Fornitore creato.");
    if (result) setSupplier(EMPTY_SUPPLIER);
  }

  async function saveMovement(event) {
    event.preventDefault();
    const result = await post({ action: "stock-move", movement }, "Movimento registrato.");
    if (result) setMovement(EMPTY_MOVE);
  }

  if (loading) return <main className={styles.page}><div className={styles.loading}>Caricamento magazzino...</div></main>;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <a href="/#/dashboard/repairs" className={styles.back}>← Riparazioni</a>
            <div className={styles.kicker}>CorSystem Repair Manager</div>
            <h1>Magazzino ricambi</h1>
            <p>Catalogo, fornitori, giacenze e movimenti tracciati.</p>
          </div>
        </header>

        {error ? <div className={styles.error}>{error}</div> : null}
        {notice ? <div className={styles.notice}>{notice}</div> : null}

        <section className={styles.metrics}>
          <Metric label="Ricambi attivi" value={data.parts.filter((item) => item.active).length} />
          <Metric label="Sotto scorta" value={lowStock} />
          <Metric label="Fornitori" value={data.suppliers.filter((item) => item.active).length} />
          <Metric label="Valore a costo" value={`€ ${money(totalValue)}`} />
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div><h2>Ricambi</h2><p>La disponibilità libera esclude i pezzi già prenotati per altre pratiche.</p></div>
            <input className={styles.search} placeholder="Cerca nome, SKU, barcode, fornitore..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Ricambio</th><th>SKU</th><th>Fornitore</th><th>Fisica</th><th>Prenotata</th><th>Libera</th><th>Scorta min.</th><th>Costo</th><th></th></tr></thead>
              <tbody>
                {filtered.map((item) => <tr key={item.id} className={item.lowStock ? styles.lowRow : ""}>
                  <td><strong>{item.defaultName}</strong><span>{item.category || "Senza categoria"}{item.location ? ` · ${item.location}` : ""}</span></td>
                  <td>{item.sku || "-"}</td>
                  <td>{item.supplier?.name || "-"}</td>
                  <td>{qty(item.stockQty)}</td><td>{qty(item.reservedQty)}</td><td><strong>{qty(item.availableQty)}</strong></td><td>{qty(item.minStock)}</td>
                  <td>€ {money(item.cost)}</td>
                  <td><button className={styles.small} onClick={() => setPart(fromPart(item))}>Modifica</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <div className={styles.twoCols}>
          <section className={styles.card}>
            <h2>{part.id ? "Modifica ricambio" : "Nuovo ricambio"}</h2>
            <form className={styles.form} onSubmit={savePart}>
              <input required placeholder="Nome ricambio" value={part.defaultName} onChange={(e) => setPart({ ...part, defaultName: e.target.value })} />
              <div className={styles.row}><input placeholder="Categoria" value={part.category} onChange={(e) => setPart({ ...part, category: e.target.value })} /><input placeholder="SKU" value={part.sku || ""} onChange={(e) => setPart({ ...part, sku: e.target.value })} /></div>
              <div className={styles.row}><input placeholder="Barcode" value={part.barcode || ""} onChange={(e) => setPart({ ...part, barcode: e.target.value })} /><input placeholder="Posizione scaffale" value={part.location} onChange={(e) => setPart({ ...part, location: e.target.value })} /></div>
              <select value={part.supplierId || ""} onChange={(e) => setPart({ ...part, supplierId: e.target.value })}><option value="">Nessun fornitore</option>{data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <div className={styles.row}><label>Costo €<input type="number" min="0" step="0.01" value={part.cost} onChange={(e) => setPart({ ...part, cost: e.target.value })} /></label><label>Prezzo €<input type="number" min="0" step="0.01" value={part.price} onChange={(e) => setPart({ ...part, price: e.target.value })} /></label></div>
              <label>Scorta minima<input type="number" min="0" step="0.001" value={part.minStock} onChange={(e) => setPart({ ...part, minStock: e.target.value })} /></label>
              <div className={styles.actions}><button disabled={saving} className={styles.primary}>Salva ricambio</button>{part.id ? <button type="button" className={styles.secondary} onClick={() => setPart(EMPTY_PART)}>Annulla</button> : null}</div>
            </form>
          </section>

          <section className={styles.card}>
            <h2>Movimento di magazzino</h2>
            <form className={styles.form} onSubmit={saveMovement}>
              <select required value={movement.partId} onChange={(e) => setMovement({ ...movement, partId: e.target.value })}><option value="">Seleziona ricambio</option>{data.parts.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.defaultName} · {p.sku || "senza SKU"}</option>)}</select>
              <select value={movement.type} onChange={(e) => setMovement({ ...movement, type: e.target.value })}><option value="RECEIVE">Carico</option><option value="ISSUE">Scarico manuale</option><option value="RETURN">Reso a magazzino</option><option value="ADJUSTMENT">Rettifica inventario</option></select>
              {movement.type === "ADJUSTMENT" ? <label>Nuova giacenza<input type="number" min="0" step="0.001" value={movement.targetStock} onChange={(e) => setMovement({ ...movement, targetStock: e.target.value })} /></label> : <label>Quantità<input type="number" min="0.001" step="0.001" value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: e.target.value })} /></label>}
              <div className={styles.row}><input placeholder="Costo unitario €" type="number" min="0" step="0.01" value={movement.unitCost} onChange={(e) => setMovement({ ...movement, unitCost: e.target.value })} /><input placeholder="Documento / riferimento" value={movement.reference} onChange={(e) => setMovement({ ...movement, reference: e.target.value })} /></div>
              <textarea placeholder="Nota movimento" value={movement.note} onChange={(e) => setMovement({ ...movement, note: e.target.value })} />
              <button disabled={saving} className={styles.primary}>Registra movimento</button>
            </form>
          </section>
        </div>

        <div className={styles.twoCols}>
          <section className={styles.card}>
            <h2>{supplier.id ? "Modifica fornitore" : "Nuovo fornitore"}</h2>
            <form className={styles.form} onSubmit={saveSupplier}>
              <input required placeholder="Ragione sociale" value={supplier.name} onChange={(e) => setSupplier({ ...supplier, name: e.target.value })} />
              <div className={styles.row}><input placeholder="P. IVA" value={supplier.vatNumber} onChange={(e) => setSupplier({ ...supplier, vatNumber: e.target.value })} /><input placeholder="Codice fiscale" value={supplier.taxCode} onChange={(e) => setSupplier({ ...supplier, taxCode: e.target.value })} /></div>
              <div className={styles.row}><input placeholder="Telefono" value={supplier.phone} onChange={(e) => setSupplier({ ...supplier, phone: e.target.value })} /><input placeholder="Email" value={supplier.email} onChange={(e) => setSupplier({ ...supplier, email: e.target.value })} /></div>
              <input placeholder="Sito web" value={supplier.website} onChange={(e) => setSupplier({ ...supplier, website: e.target.value })} />
              <textarea placeholder="Indirizzo / note" value={supplier.address} onChange={(e) => setSupplier({ ...supplier, address: e.target.value })} />
              <div className={styles.actions}><button disabled={saving} className={styles.primary}>Salva fornitore</button>{supplier.id ? <button type="button" className={styles.secondary} onClick={() => setSupplier(EMPTY_SUPPLIER)}>Annulla</button> : null}</div>
            </form>
            <div className={styles.chips}>{data.suppliers.map((s) => <button key={s.id} className={styles.chip} onClick={() => setSupplier({ ...EMPTY_SUPPLIER, ...s })}>{s.name}</button>)}</div>
          </section>

          <section className={styles.card}>
            <h2>Ultimi movimenti</h2>
            <div className={styles.movements}>{data.recentMovements.slice(0, 20).map((m) => <div className={styles.movement} key={m.id}><div><strong>{m.part?.defaultName}</strong><span>{movementLabel(m.type)}{m.repair?.ticket ? ` · ${m.repair.ticket}` : ""}</span></div><div className={Number(m.quantity) >= 0 ? styles.plus : styles.minus}>{Number(m.quantity) >= 0 ? "+" : ""}{qty(m.quantity)}</div></div>)}</div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }) { return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>; }
function fromPart(item) { return { id: item.id, defaultName: item.defaultName, category: item.category, sku: item.sku || "", barcode: item.barcode || "", supplierId: item.supplierId || "", price: Number(item.price || 0), cost: Number(item.cost || 0), minStock: Number(item.minStock || 0), location: item.location || "", active: item.active !== false }; }
function money(value) { return Number(value || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function qty(value) { return Number(value || 0).toLocaleString("it-IT", { maximumFractionDigits: 3 }); }
function movementLabel(type) { return ({ RECEIVE: "Carico", ISSUE: "Scarico", RETURN: "Reso", ADJUSTMENT: "Rettifica" })[type] || type; }
