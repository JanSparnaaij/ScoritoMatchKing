import { buildMatchPrediction } from "@/application/services/prediction-service";
import { container } from "@/infrastructure/di/container";

export async function GET() {
  const matches = await container.repositories.matchRepository.getUpcoming();
  const predictions = matches.map(buildMatchPrediction);
  return Response.json({ count: predictions.length, predictions });
}
