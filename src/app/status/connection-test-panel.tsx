"use client";

import { useState } from "react";

type ProviderProbe = {
  configured: boolean;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  message: string;
};

type ProbeResult = {
  testedAt: string;
  apiFootball: ProviderProbe;
  oddsApi: ProviderProbe;
};

function ProbeCard({ label, probe }: { label: string; probe: ProviderProbe }) {
  return (
    <div className="rounded-lg border border-line bg-surface-muted p-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium">{label}</p>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            probe.ok ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {probe.ok ? "Reachable" : "Issue"}
        </span>
      </div>
      <p>Configured: {probe.configured ? "yes" : "no"}</p>
      <p>Status: {probe.statusCode ?? "-"}</p>
      <p>Latency: {probe.latencyMs ?? "-"} ms</p>
      <p className="mt-1 text-slate-600">{probe.message}</p>
    </div>
  );
}

export function ConnectionTestPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/status", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ProbeResult;
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card mb-6 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Test API Connections</h2>
        <button
          type="button"
          onClick={runTest}
          disabled={loading}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-65"
        >
          {loading ? "Testing..." : "Run test"}
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-red-700">Error: {error}</p> : null}
      {result ? <p className="mb-3 text-xs text-slate-500">Last test: {result.testedAt}</p> : null}

      {result ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ProbeCard label="API-Football" probe={result.apiFootball} />
          <ProbeCard label="The Odds API" probe={result.oddsApi} />
        </div>
      ) : (
        <p className="text-sm text-slate-600">Run test om live connectivity en key-validatie te zien.</p>
      )}
    </section>
  );
}
