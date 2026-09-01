"use client";

export default function PrintActions({ repairId, publicToken }) {
  const encodedId = encodeURIComponent(String(repairId || ""));
  const encodedToken = encodeURIComponent(String(publicToken || ""));

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }} className="no-print">
      <button type="button" onClick={() => window.print()}>
        Stampa ora
      </button>
      {encodedId ? <a href={`/ricevuta/${encodedId}?format=a4`}>Formato A4</a> : null}
      {encodedId ? <a href={`/ricevuta/${encodedId}?format=thermal`}>Formato termico</a> : null}
      {encodedToken ? <a href={`/stato/${encodedToken}`} target="_blank" rel="noreferrer">Apri stato cliente</a> : null}
      <a href="/#/dashboard/repairs">Torna alle riparazioni</a>
    </div>
  );
}
