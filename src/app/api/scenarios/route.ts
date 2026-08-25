import { buildMatchPrediction } from "@/application/services/prediction-service";
import { container } from "@/infrastructure/di/container";

export async function GET() {
  const matches = await container.repositories.matchRepository.getUpcoming();

  const scenarios = matches.map((match) => {
    const prediction = buildMatchPrediction(match);
    return {
      matchId: match.id,
      teams: `${match.homeTeam} - ${match.awayTeam}`,
      safe: prediction.strategyPicks.SAFE,
      balanced: prediction.strategyPicks.BALANCED,
      aggressive: prediction.strategyPicks.AGGRESSIVE,
    };
  });

  return Response.json({ scenarios });
}
