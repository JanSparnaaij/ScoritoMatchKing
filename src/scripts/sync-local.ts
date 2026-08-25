import { runLocalSync } from "@/application/services/sync-service";
import { GameVariant } from "@/domain/enums";
import { container } from "@/infrastructure/di/container";

(async () => {
  const rawVariant = process.argv[2]?.toUpperCase();
  const variant = rawVariant && [GameVariant.NL, GameVariant.KKD, GameVariant.BE, GameVariant.INT, GameVariant.EUR, GameVariant.INTERLANDS].includes(rawVariant as GameVariant)
    ? (rawVariant as GameVariant)
    : undefined;

  const result = await runLocalSync({
    matchProvider: container.adapters.oddsApiAdapter,
    oddsProvider: container.adapters.oddsApiAdapter,
    matchRepository: container.repositories.matchRepository,
    variant,
  });

  console.log("Local sync completed:", result);
})().catch((error) => {
  console.error("Local sync failed", error);
  process.exit(1);
});
