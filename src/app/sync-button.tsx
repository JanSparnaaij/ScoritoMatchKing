"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GameVariant } from "@/domain/enums";

type SyncResponse = {
  status: string;
  syncedMatches?: number;
  syncedPlayers?: number;
  predictionCount?: number;
  syncedAt?: string;
  message?: string;
};

type SyncButtonProps = {
  variant?: GameVariant;
};

export function SyncButton({ variant }: SyncButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string>("");

  const runSync = async () => {
    setFeedback("");

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(variant ? { variant } : {}),
      });

      const payload = (await response.json()) as SyncResponse;

      if (!response.ok) {
        setFeedback(payload.message ?? "Sync mislukt");
        return;
      }

      setFeedback(
        `Sync OK: ${payload.syncedMatches ?? 0} matches, ${payload.syncedPlayers ?? 0} spelers${variant ? ` (${variant})` : ""}`,
      );

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Onbekende fout tijdens sync");
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={runSync}
        disabled={isPending}
        className="inline-flex items-center rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Syncen..." : "Sync nu via API"}
      </button>
      {feedback ? <p className="mt-2 text-xs text-slate-600">{feedback}</p> : null}
    </div>
  );
}