"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

const NEW_CLIENT = "__new_client__";
const NEW_DEVICE = "__new_device__";
const EMPTY_CLIENT = {
  name: "",
  phone: "",
  email: "",
  docType: "CF",
  identity: "",
  address: ""
};
const EMPTY_DEVICE = {
  type: "Smartphone",
  brand: "",
  model: "",
  imei: "",
  serialNumber: "",
  color: "",
  notes: ""
};

export default function IntakePage() {
  const [bootstrap, setBootstrap] = useState({
    clients: [],
    technicians: [],
    deviceTypes: [],
    accessories: [],
    conditionFlags: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const [clientSearch, setClientSearch] = useState("");
  const [clientChoice, setClientChoice] = useState("");
  const [newClient, setNewClient] = useState(EMPTY_CLIENT);
  const [devices, setDevices] = useState([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceChoice, setDeviceChoice] = useState(NEW_DEVICE);
  const [newDevice, setNewDevice] = useState(EMPTY_DEVICE);

  const [reportedIssue, setReportedIssue] = useState("");
  const [initialCondition, setInitialCondition] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [notes, setNotes] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [frontPhoto, setFrontPhoto] = useState("");
  const [backPhoto, setBackPhoto] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  useEffect(() => {
    let active = true;
    fetchJson("/api/intake")
      .then((data) => {
        if (!active) return;
        setBootstrap(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Impossibile caricare l'accettazione");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLocaleLowerCase("it-IT");
    if (!query) return bootstrap.clients;
    return bootstrap.clients.filter((client) =>
      [client.name, client.phone, client.identity, client.email]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("it-IT").includes(query))
    );
  }, [bootstrap.clients, clientSearch]);

  const selectedClient = useMemo(
    () => bootstrap.clients.find((client) => client.id === clientChoice) || null,
    [bootstrap.clients, clientChoice]
  );
  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === deviceChoice) || null,
    [devices, deviceChoice]
  );

  useEffect(() => {
    if (!clientChoice || clientChoice === NEW_CLIENT) {
      setDevices([]);
      setDeviceChoice(NEW_DEVICE);
      return;
    }
    let active = true;
    setDeviceLoading(true);
    fetchJson(`/api/devices?clientId=${encodeURIComponent(clientChoice)}`)
      .then((rows) => {
        if (!active) return;
        const next = Array.isArray(rows) ? rows : [];
        setDevices(next);
        setDeviceChoice(next[0]?.id || NEW_DEVICE);
      })
      .catch((err) => {
        if (!active) return;
        setDevices([]);
        setDeviceChoice(NEW_DEVICE);
        setError(err.message || "Impossibile caricare i dispositivi del cliente");
      })
      .finally(() => {
        if (active) setDeviceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clientChoice]);

  function resetForm() {
    setSuccess(null);
    setError("");
    setClientSearch("");
    setClientChoice("");
    setNewClient(EMPTY_CLIENT);
    setDevices([]);
    setDeviceChoice(NEW_DEVICE);
    setNewDevice(EMPTY_DEVICE);
    setReportedIssue("");
    setInitialCondition([]);
    setAccessories([]);
    setNotes("");
    setInternalNote("");
    setTechnicianId("");
    setFrontPhoto("");
    setBackPhoto("");
    setSignatureDataUrl("");
    setPrivacyAccepted(false);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (!clientChoice) return setError("Seleziona un cliente oppure scegli “Nuovo cliente”.");
    if (clientChoice === NEW_CLIENT && (!newClient.name.trim() || !newClient.phone.trim())) {
      return setError("Per un nuovo cliente sono obbligatori nome e telefono.");
    }
    if (deviceChoice === NEW_DEVICE && !hasDeviceIdentity(newDevice)) {
      return setError("Inserisci almeno marca/modello, IMEI o numero seriale del dispositivo.");
    }
    if (!reportedIssue.trim()) return setError("Descrivi il problema segnalato dal cliente.");
    if (!privacyAccepted) return setError("È necessario accettare l'informativa privacy.");

    setSaving(true);
    try {
      const body = {
        clientId: clientChoice === NEW_CLIENT ? "" : clientChoice,
        client: clientChoice === NEW_CLIENT ? newClient : undefined,
        deviceId: deviceChoice === NEW_DEVICE ? "" : deviceChoice,
        device: deviceChoice === NEW_DEVICE ? newDevice : undefined,
        reportedIssue,
        initialCondition,
        accessories,
        notes,
        internalNote,
        technicianId,
        frontPhoto,
        backPhoto,
        signatureDataUrl,
        privacyAccepted
      };
      const result = await fetchJson("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      setSuccess(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Errore durante la creazione della pratica");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className={styles.page}><div className={styles.shell}>Caricamento accettazione CorSystem…</div></main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>CorSystem · Repair Manager</p>
            <h1 className={styles.title}>Accettazione dispositivo</h1>
            <p className={styles.subtitle}>
              Registra cliente, dispositivo e condizioni di ingresso. La pratica viene collegata allo storico del dispositivo e riceve automaticamente un numero CS.
            </p>
          </div>
          <a className={styles.backLink} href="/dashboard/repairs">← Torna alle riparazioni</a>
        </header>

        {success ? <SuccessPanel result={success} onReset={resetForm} /> : (
          <form onSubmit={submit}>
            {error ? <div className={styles.error}>{error}</div> : null}
            <div className={styles.grid}>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}><span className={styles.step}>1</span> Cliente</h2>
                <p className={styles.cardHint}>Richiama un cliente esistente oppure registrane uno nuovo.</p>
                <div className={styles.fields}>
                  <Field label="Cerca cliente" full>
                    <input
                      className={styles.input}
                      value={clientSearch}
                      onChange={(event) => setClientSearch(event.target.value)}
                      placeholder="Nome, telefono, codice fiscale o email"
                    />
                  </Field>
                  <Field label="Cliente" full>
                    <select className={styles.select} value={clientChoice} onChange={(event) => setClientChoice(event.target.value)}>
                      <option value="">Seleziona…</option>
                      <option value={NEW_CLIENT}>＋ Nuovo cliente</option>
                      {filteredClients.map((client) => (
                        <option key={client.id} value={client.id}>{client.name} · {client.phone}</option>
                      ))}
                    </select>
                  </Field>

                  {clientChoice === NEW_CLIENT ? (
                    <>
                      <Field label="Nome e cognome"><TextInput value={newClient.name} onChange={(value) => patch(setNewClient, "name", value)} /></Field>
                      <Field label="Telefono"><TextInput value={newClient.phone} onChange={(value) => patch(setNewClient, "phone", value)} inputMode="tel" /></Field>
                      <Field label="Email"><TextInput value={newClient.email} onChange={(value) => patch(setNewClient, "email", value)} inputMode="email" /></Field>
                      <Field label="Codice fiscale"><TextInput value={newClient.identity} onChange={(value) => patch(setNewClient, "identity", value.toUpperCase())} /></Field>
                      <Field label="Indirizzo" full><TextInput value={newClient.address} onChange={(value) => patch(setNewClient, "address", value)} /></Field>
                    </>
                  ) : selectedClient ? (
                    <div className={`${styles.mutedBox} ${styles.fieldFull}`}>
                      <strong>{selectedClient.name}</strong><br />
                      {selectedClient.phone || "Telefono non indicato"}
                      {selectedClient.email ? ` · ${selectedClient.email}` : ""}
                      {selectedClient.identity ? <><br />CF/Documento: {selectedClient.identity}</> : null}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}><span className={styles.step}>2</span> Dispositivo</h2>
                <p className={styles.cardHint}>Riusa un dispositivo già censito per costruire uno storico unico nel tempo.</p>
                <div className={styles.fields}>
                  {clientChoice && clientChoice !== NEW_CLIENT ? (
                    <Field label="Dispositivo del cliente" full>
                      <select
                        className={styles.select}
                        value={deviceChoice}
                        disabled={deviceLoading}
                        onChange={(event) => setDeviceChoice(event.target.value)}
                      >
                        {devices.map((device) => (
                          <option key={device.id} value={device.id}>{deviceLabel(device)}</option>
                        ))}
                        <option value={NEW_DEVICE}>＋ Registra nuovo dispositivo</option>
                      </select>
                    </Field>
                  ) : null}

                  {deviceChoice === NEW_DEVICE ? (
                    <>
                      <Field label="Tipo">
                        <select className={styles.select} value={newDevice.type} onChange={(event) => patch(setNewDevice, "type", event.target.value)}>
                          {(bootstrap.deviceTypes || []).map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </Field>
                      <Field label="Marca"><TextInput value={newDevice.brand} onChange={(value) => patch(setNewDevice, "brand", value)} placeholder="Apple, Samsung, HP…" /></Field>
                      <Field label="Modello"><TextInput value={newDevice.model} onChange={(value) => patch(setNewDevice, "model", value)} placeholder="iPhone 15, Galaxy S25…" /></Field>
                      <Field label="Colore"><TextInput value={newDevice.color} onChange={(value) => patch(setNewDevice, "color", value)} /></Field>
                      <Field label="IMEI"><TextInput value={newDevice.imei} onChange={(value) => patch(setNewDevice, "imei", value.replace(/\D/g, "").slice(0, 15))} inputMode="numeric" /></Field>
                      <Field label="Numero seriale"><TextInput value={newDevice.serialNumber} onChange={(value) => patch(setNewDevice, "serialNumber", value.toUpperCase())} /></Field>
                      <Field label="Note dispositivo" full>
                        <textarea className={styles.textarea} value={newDevice.notes} onChange={(event) => patch(setNewDevice, "notes", event.target.value)} />
                      </Field>
                    </>
                  ) : selectedDevice ? (
                    <div className={`${styles.mutedBox} ${styles.fieldFull}`}>
                      <strong>{deviceLabel(selectedDevice)}</strong>
                      {selectedDevice.color ? <><br />Colore: {selectedDevice.color}</> : null}
                      {selectedDevice.notes ? <><br />{selectedDevice.notes}</> : null}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className={`${styles.card} ${styles.full}`}>
                <h2 className={styles.cardTitle}><span className={styles.step}>3</span> Accettazione</h2>
                <p className={styles.cardHint}>Fotografa lo stato iniziale e descrivi esattamente ciò che il cliente consegna.</p>
                <div className={styles.fields}>
                  <Field label="Problema segnalato dal cliente" full>
                    <textarea
                      className={styles.textarea}
                      value={reportedIssue}
                      onChange={(event) => setReportedIssue(event.target.value)}
                      placeholder="Esempio: display rotto, touch non risponde, il telefono continua ad accendersi…"
                    />
                  </Field>

                  <div className={styles.fieldFull}>
                    <div className={styles.label}>Condizioni iniziali</div>
                    <div className={styles.checkGrid}>
                      {(bootstrap.conditionFlags || []).map((item) => (
                        <CheckItem key={item} label={item} checked={initialCondition.includes(item)} onChange={() => setInitialCondition(toggle(initialCondition, item))} />
                      ))}
                    </div>
                  </div>

                  <div className={styles.fieldFull}>
                    <div className={styles.label}>Accessori consegnati</div>
                    <div className={styles.checkGrid}>
                      {(bootstrap.accessories || []).map((item) => (
                        <CheckItem key={item} label={item} checked={accessories.includes(item)} onChange={() => setAccessories(toggle(accessories, item))} />
                      ))}
                    </div>
                  </div>

                  <Field label="Note di accettazione" full>
                    <textarea className={styles.textarea} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Graffi, ammaccature, accessori particolari, richieste del cliente…" />
                  </Field>
                  <Field label="Nota interna per il laboratorio" full>
                    <textarea className={styles.textarea} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Questa nota non è destinata al cliente." />
                  </Field>
                  <Field label="Tecnico assegnato">
                    <select className={styles.select} value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>
                      <option value="">Da assegnare</option>
                      {(bootstrap.technicians || []).map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}
                    </select>
                  </Field>
                </div>
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}><span className={styles.step}>4</span> Foto</h2>
                <p className={styles.cardHint}>Le foto documentano le condizioni del dispositivo all’ingresso.</p>
                <div className={styles.photoGrid}>
                  <PhotoField label="Foto anteriore" value={frontPhoto} onChange={setFrontPhoto} />
                  <PhotoField label="Foto posteriore" value={backPhoto} onChange={setBackPhoto} />
                </div>
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}><span className={styles.step}>5</span> Firma e privacy</h2>
                <p className={styles.cardHint}>La firma viene salvata con la pratica di accettazione.</p>
                <SignaturePad value={signatureDataUrl} onChange={setSignatureDataUrl} />
                <label className={styles.privacy}>
                  <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
                  <span>Il cliente dichiara corretti i dati di accettazione e prende visione dell’informativa privacy e delle condizioni del servizio di riparazione.</span>
                </label>
              </section>
            </div>

            <div className={styles.actions}>
              <span>{signatureDataUrl ? "Firma acquisita ✓" : "Firma non ancora acquisita"}</span>
              <button className={styles.primaryButton} type="submit" disabled={saving}>
                {saving ? "Creazione pratica…" : "Crea pratica CorSystem"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function Field({ label, full = false, children }) {
  return <label className={`${styles.field} ${full ? styles.fieldFull : ""}`}><span className={styles.label}>{label}</span>{children}</label>;
}

function TextInput({ value, onChange, ...props }) {
  return <input className={styles.input} value={value} onChange={(event) => onChange(event.target.value)} {...props} />;
}

function CheckItem({ label, checked, onChange }) {
  return <label className={styles.checkItem}><input type="checkbox" checked={checked} onChange={onChange} /><span>{label}</span></label>;
}

function PhotoField({ label, value, onChange }) {
  const [error, setError] = useState("");
  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      onChange(await readImage(file));
    } catch (err) {
      setError(err.message || "Foto non valida");
    }
  }
  return (
    <div className={styles.photoBox}>
      <div className={styles.label}>{label}</div>
      <input type="file" accept="image/*" capture="environment" onChange={handleFile} />
      {error ? <div className={styles.error}>{error}</div> : null}
      {value ? <img className={styles.photoPreview} src={value} alt={label} /> : null}
    </div>
  );
}

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
  }, []);

  function point(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function start(event) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawingRef.current = true;
    canvas.setPointerCapture?.(event.pointerId);
    const context = canvas.getContext("2d");
    const p = point(event);
    context.beginPath();
    context.moveTo(p.x, p.y);
  }

  function move(event) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const p = point(event);
    context.lineTo(p.x, p.y);
    context.stroke();
  }

  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div className={styles.signatureWrap}>
      <canvas
        ref={canvasRef}
        width="900"
        height="300"
        className={styles.signatureCanvas}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label="Firma cliente"
      />
      <div className={styles.signatureToolbar}>
        <span>{value ? "Firma acquisita" : "Firma qui con dito, mouse o penna"}</span>
        <button className={styles.secondaryButton} type="button" onClick={clear}>Cancella firma</button>
      </div>
    </div>
  );
}

function SuccessPanel({ result, onReset }) {
  const repair = result?.repair || {};
  const client = result?.client || {};
  const device = result?.device || {};
  return (
    <section className={styles.success}>
      <strong>Pratica creata correttamente</strong>
      <div className={styles.successTicket}>{repair.ticket}</div>
      <div>{client.name} · {deviceLabel(device)}</div>
      <div className={styles.successLinks}>
        <a href={`/dashboard/repairs/${encodeURIComponent(repair.id)}`}>Apri pratica</a>
        <button type="button" onClick={onReset}>Nuova accettazione</button>
      </div>
    </section>
  );
}

function patch(setter, key, value) {
  setter((current) => ({ ...current, [key]: value }));
}

function toggle(list, item) {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
}

function hasDeviceIdentity(device) {
  return Boolean(String(device.brand || "").trim() || String(device.model || "").trim() || String(device.imei || "").trim() || String(device.serialNumber || "").trim());
}

function deviceLabel(device) {
  if (!device) return "Dispositivo";
  const main = [device.type, device.brand, device.model].filter(Boolean).join(" ") || "Dispositivo";
  const identifier = device.imei ? `IMEI ${device.imei}` : device.serialNumber ? `S/N ${device.serialNumber}` : "";
  return [main, identifier].filter(Boolean).join(" · ");
}

function readImage(file) {
  if (!file.type.startsWith("image/")) return Promise.reject(new Error("Seleziona un file immagine"));
  if (file.size > 6 * 1024 * 1024) return Promise.reject(new Error("La foto supera 6 MB"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Impossibile leggere la foto"));
    reader.readAsDataURL(file);
  });
}

async function fetchJson(url, options) {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Errore ${response.status}`);
  return data;
}
