import { getLocalStatus } from "@/application/services/status-service";
import { ConnectionTestPanel } from "@/app/status/connection-test-panel";

export const dynamic = "force-dynamic";

function Badge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${
        ok ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {ok ? "Configured" : "Missing"}
    </span>
  );
}

export default async function StatusPage() {
  const status = await getLocalStatus();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <section className="mb-6">
        <h1 className="text-3xl font-semibold">Local Status</h1>
        <p className="mt-2 text-sm text-slate-600">
          Controle van lokale keys en laatste sync-run. Secrets zelf worden niet getoond.
        </p>
      </section>

      <section className="card mb-6 p-5">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-surface-muted px-3 py-1">Mode: {status.mode}</span>
          <span className="rounded-full bg-surface-muted px-3 py-1">
            External sync: {status.externalSyncEnabled ? "enabled" : "disabled"}
          </span>
        </div>
      </section>

      <section className="card mb-6 p-5">
        <h2 className="mb-4 text-xl font-semibold">API Keys</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-line bg-surface-muted p-3">
            <p className="mb-2 text-sm font-medium">API-Football</p>
            <Badge ok={status.keys.apiFootball} />
          </div>
          <div className="rounded-lg border border-line bg-surface-muted p-3">
            <p className="mb-2 text-sm font-medium">The Odds API</p>
            <Badge ok={status.keys.oddsApi} />
          </div>
        </div>
      </section>

      <ConnectionTestPanel />

      <section className="card p-5">
        <h2 className="mb-4 text-xl font-semibold">Laatste Sync</h2>
        {!status.latestSync ? (
          <p className="text-sm text-slate-600">Nog geen sync gedraaid. Gebruik eerst npm run sync:local.</p>
        ) : (
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p>Round: {status.latestSync.roundCode}</p>
            <p>Synced at: {status.latestSync.syncedAt}</p>
            <p>Matches: {status.latestSync.matches}</p>
            <p>Players: {status.latestSync.players}</p>
            <p>Predictions: {status.latestSync.predictions}</p>
            <p>Source: {status.latestSync.source}</p>
          </div>
        )}
      </section>
    </main>
  );
}
