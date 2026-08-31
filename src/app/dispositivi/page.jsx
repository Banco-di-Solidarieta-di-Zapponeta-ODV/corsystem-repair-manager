import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deviceDisplayName, deviceIdentifier, formatItalianDateTime, repairStatusLabel } from "@/features/intake/receipt";
import styles from "./devices.module.css";

export const metadata = {
  title: "Dispositivi | CorSystem Repair Manager"
};

export default async function DevicesPage({ searchParams }) {
  const params = await searchParams;
  const query = String(params?.q || "").trim().slice(0, 100);

  const matchingClients = query
    ? await prisma.client.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { phone: { contains: query } },
            { email: { contains: query } },
            { identity: { contains: query } }
          ]
        },
        select: { id: true },
        take: 80
      })
    : [];

  const clientIds = matchingClients.map((client) => client.id);
  const where = query
    ? {
        OR: [
          { brand: { contains: query } },
          { model: { contains: query } },
          { imei: { contains: query } },
          { serialNumber: { contains: query } },
          { color: { contains: query } },
          { clientId: { in: clientIds.length ? clientIds : ["__none__"] } }
        ]
      }
    : undefined;

  const [devices, totalDevices, linkedRepairs] = await Promise.all([
    prisma.device.findMany({
      where,
      include: {
        client: true,
        _count: { select: { repairs: true } },
        repairs: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { id: true, ticket: true, status: true, updatedAt: true }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 150
    }),
    prisma.device.count(),
    prisma.repair.count({ where: { deviceId: { not: null } } })
  ]);

  const devicesWithHistory = devices.filter((device) => device._count.repairs > 0).length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div>
            <div className={styles.eyebrow}>CorSystem Repair Manager</div>
            <h1 className={styles.title}>Dispositivi</h1>
          </div>
          <div className={styles.topActions}>
            <Link className={styles.buttonGhost} href="/#/dashboard/repairs">Riparazioni</Link>
            <Link className={styles.button} href="/intake">＋ Nuova accettazione</Link>
          </div>
        </header>

        <form className={styles.search} action="/dispositivi" method="get">
          <input
            name="q"
            defaultValue={query}
            placeholder="Cerca cliente, telefono, marca, modello, IMEI o seriale…"
            autoComplete="off"
          />
          <button type="submit">Cerca</button>
        </form>

        <section className={styles.stats}>
          <Stat value={totalDevices} label="Dispositivi registrati" />
          <Stat value={linkedRepairs} label="Riparazioni collegate" />
          <Stat value={query ? devices.length : devicesWithHistory} label={query ? "Risultati trovati" : "Con storico interventi"} />
        </section>

        {devices.length ? (
          <section className={styles.grid}>
            {devices.map((device) => {
              const latest = device.repairs[0];
              return (
                <Link className={styles.card} href={`/dispositivi/${encodeURIComponent(device.id)}`} key={device.id}>
                  <div className={styles.cardHead}>
                    <div>
                      <div className={styles.deviceName}>{deviceDisplayName(device)}</div>
                      <div className={styles.identifier}>{deviceIdentifier(device) || "Nessun identificativo"}</div>
                    </div>
                    <span className={styles.pill}>{device.type || "Altro"}</span>
                  </div>
                  <div className={styles.client}>{device.client?.name || "Cliente"}</div>
                  <div className={styles.muted}>{device.client?.phone || device.client?.email || "Nessun recapito"}</div>
                  <div className={styles.meta}>
                    <span className={styles.pill}>{device._count.repairs} interventi</span>
                    {device.color ? <span className={styles.pill}>{device.color}</span> : null}
                  </div>
                  <div className={styles.status}>
                    <span>{latest ? repairStatusLabel(latest.status) : "Nessun intervento"}</span>
                    <span>{latest ? formatItalianDateTime(latest.updatedAt) : ""}</span>
                  </div>
                </Link>
              );
            })}
          </section>
        ) : (
          <div className={styles.empty}>
            Nessun dispositivo trovato{query ? ` per “${query}”` : ""}.
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ value, label }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}
