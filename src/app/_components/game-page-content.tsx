import { buildDashboardView } from "@/application/services/dashboard-service";
import { runLocalSync } from "@/application/services/sync-service";
import { GameVariant } from "@/domain/enums";
import { container } from "@/infrastructure/di/container";
import { SyncButton } from "@/app/sync-button";

type GamePageContentProps = {
  variant: GameVariant;
  title: string;
  subtitle: string;
  selectedRound?: number;
};

export async function GamePageContent({ variant, title, subtitle, selectedRound }: GamePageContentProps) {
  const persistedMatches = await container.repositories.matchRepository.getPersistedMatches(variant);

  if (persistedMatches.length === 0) {
    try {
      await runLocalSync({
        matchProvider: container.adapters.oddsApiAdapter,
        oddsProvider: container.adapters.oddsApiAdapter,
        matchRepository: container.repositories.matchRepository,
        variant,
      });
    } catch {
      // Pagina blijft bruikbaar; handmatige sync kan via knop.
    }
  }

  const dashboard = await buildDashboardView({
    matchRepository: container.repositories.matchRepository,
    variant,
    selectedRound,
  });

  const showKkdAvailabilityMessage = variant === GameVariant.KKD && dashboard.rounds.length === 0;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <section className="mb-5 flex flex-wrap items-center gap-2 text-xs">
        <a href="/nl" className="rounded-full border border-line bg-white px-3 py-1.5 font-medium hover:bg-surface-muted">Match King NL</a>
        <a href="/kkd" className="rounded-full border border-line bg-white px-3 py-1.5 font-medium hover:bg-surface-muted">Match King KKD</a>
        <a href="/be" className="rounded-full border border-line bg-white px-3 py-1.5 font-medium hover:bg-surface-muted">Match King BE</a>
        <a href="/int" className="rounded-full border border-line bg-white px-3 py-1.5 font-medium hover:bg-surface-muted">Match King INT</a>
        <a href="/eur" className="rounded-full border border-line bg-white px-3 py-1.5 font-medium hover:bg-surface-muted">Match King EUR</a>
        <a href="/interlands" className="rounded-full border border-line bg-white px-3 py-1.5 font-medium hover:bg-surface-muted">Match King Interlands</a>
        <a href="/status" className="rounded-full border border-line bg-white px-3 py-1.5 font-medium hover:bg-surface-muted">Status</a>
      </section>

      <section className="mb-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-[#853213]">
            {title}
          </p>
          <h1 className="text-3xl font-semibold md:text-4xl">Ronde-overzicht en advies</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="card p-4 text-sm">
          <p className="text-slate-500">Laatste sync</p>
          <p className="font-mono text-sm font-semibold">{dashboard.syncedAtLabel}</p>
          <SyncButton variant={variant} />
        </div>
      </section>

      <section className="mb-6 card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Kies speelronde</h2>
        {showKkdAvailabilityMessage ? (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            KKD live-data is momenteel niet beschikbaar via de gekoppelde API&apos;s. Probeer later opnieuw via sync.
          </div>
        ) : null}
        {dashboard.rounds.length === 0 ? (
          <p className="text-sm text-slate-600">Nog geen gespeelde rondes voor {variant}. Start met een sync.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dashboard.rounds.map((round) => (
              <a
                key={round.roundNumber}
                href={`?round=${round.roundNumber}`}
                className={`rounded-md border px-3 py-2 text-xs transition ${round.isSelected ? "border-accent bg-accent text-white" : "border-line bg-white hover:bg-surface-muted"}`}
              >
                <span className="block font-semibold">{round.label}</span>
                <span className={`block ${round.isSelected ? "text-white/90" : "text-slate-500"}`}>
                  {round.dateRangeLabel} · {round.matchesCount} matches
                </span>
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboard.kpis.map((kpi) => (
          <article key={kpi.label} className="card p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{kpi.label}</p>
            <p className="mt-1 text-3xl font-semibold">{kpi.value}</p>
          </article>
        ))}
      </section>

      <section>
        <article className="card p-5">
          <h2 className="mb-4 text-xl font-semibold">Wedstrijden ({variant}) met voorspelde uitslag</h2>
          {dashboard.matchCards.length === 0 ? (
            <p className="text-sm text-slate-600">
              {showKkdAvailabilityMessage
                ? "Nog geen KKD wedstrijden beschikbaar via de gekoppelde API's."
                : `Nog geen wedstrijden voor ${variant}. Klik op "Sync nu via API".`}
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {dashboard.matchCards.map((match) => (
                <div key={match.matchId} className="rounded-lg border border-line bg-surface-muted px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{match.title}</p>
                      <p className="text-xs text-slate-600">{match.competition}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        1: {match.odds.home}  X: {match.odds.draw}  2: {match.odds.away}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md bg-white px-2 py-1 text-slate-700">SAFE: {match.safeScore}</span>
                        <span className="rounded-md bg-white px-2 py-1 text-slate-700">AGGRESSIVE: {match.aggressiveScore}</span>
                      </div>
                    </div>
                    <div className="shrink-0 rounded-md bg-white px-3 py-1.5 text-sm font-semibold">
                      {match.recommendedScore}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}