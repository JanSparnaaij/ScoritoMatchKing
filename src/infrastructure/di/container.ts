import { buildMatchPrediction } from "@/application/services/prediction-service";
import { ApiFootballAdapter } from "@/infrastructure/adapters/api-football-adapter";
import { OddsApiAdapter } from "@/infrastructure/adapters/odds-api-adapter";
import { PrismaMatchRepository } from "@/infrastructure/repositories/prisma-repository";

const apiFootballAdapter = new ApiFootballAdapter();
const oddsApiAdapter = new OddsApiAdapter();
const matchRepository = new PrismaMatchRepository();

export const container = {
  adapters: {
    apiFootballAdapter,
    oddsApiAdapter,
  },
  repositories: {
    matchRepository,
  },
  services: {
    buildMatchPrediction,
  },
};
