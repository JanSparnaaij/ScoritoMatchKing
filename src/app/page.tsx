import { SyncButton } from "@/app/sync-button";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <section className="mb-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-[#853213]">
            Scorito MatchKing Advisor
          </p>
          <h1 className="text-3xl font-semibold md:text-4xl">Kies je spel</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Zes aparte pagina&apos;s: Match King NL, KKD, BE, INT, EUR en Interlands.
          </p>
        </div>
        <div className="card p-4 text-sm">
          <p className="text-slate-500">Data verversen</p>
          <SyncButton />
          <a href="/status" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
            Open local status
          </a>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <a href="/nl" className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
          <h2 className="text-xl font-semibold">Match King NL</h2>
          <p className="mt-2 text-sm text-slate-600">Alleen Eredivisie wedstrijden en scorers per ronde.</p>
        </a>
        <a href="/kkd" className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
          <h2 className="text-xl font-semibold">Match King KKD</h2>
          <p className="mt-2 text-sm text-slate-600">Alleen Keuken Kampioen Divisie wedstrijden en scorers per ronde.</p>
        </a>
        <a href="/be" className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
          <h2 className="text-xl font-semibold">Match King BE</h2>
          <p className="mt-2 text-sm text-slate-600">Alleen Belgische hoogste divisie en scorers per ronde.</p>
        </a>
        <a href="/int" className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
          <h2 className="text-xl font-semibold">Match King INT</h2>
          <p className="mt-2 text-sm text-slate-600">Topcompetities uit Spanje, Engeland, Duitsland, Frankrijk en Italië.</p>
        </a>
        <a href="/eur" className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
          <h2 className="text-xl font-semibold">Match King EUR</h2>
          <p className="mt-2 text-sm text-slate-600">Champions League, Europa League en Conference League per ronde.</p>
        </a>
        <a href="/interlands" className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
          <h2 className="text-xl font-semibold">Match King Interlands</h2>
          <p className="mt-2 text-sm text-slate-600">Landenwedstrijden: Nations League, WK- en EK-kwalificaties en eindrondes.</p>
        </a>
      </section>
    </main>
  );
}
