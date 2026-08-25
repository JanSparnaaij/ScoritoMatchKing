import { runLocalSync } from "@/application/services/sync-service";
import { GameVariant } from "@/domain/enums";
import { container } from "@/infrastructure/di/container";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { variant?: GameVariant };

    const result = await runLocalSync({
      matchProvider: container.adapters.oddsApiAdapter,
      oddsProvider: container.adapters.oddsApiAdapter,
      matchRepository: container.repositories.matchRepository,
      variant: payload.variant,
    });

    return Response.json({
      status: "ok",
      syncedMatches: result.syncedMatches,
      syncedPlayers: result.syncedPlayers,
      predictionCount: result.predictionCount,
      roundCode: result.roundCode,
      externalSyncEnabled: process.env.ENABLE_EXTERNAL_SYNC === "true",
      syncedAt: result.syncedAt,
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Sync mislukt",
      },
      { status: 500 },
    );
  }
}
