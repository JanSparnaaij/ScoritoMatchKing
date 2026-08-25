import { describe, expect, it } from "vitest";
import { fixtureMatches } from "@/application/fixtures/match-fixtures";
import { buildMatchPrediction } from "@/application/services/prediction-service";

describe("prediction service", () => {
  it("returns top 5 scorelines and strategy picks", () => {
    const prediction = buildMatchPrediction(fixtureMatches[0]);

    expect(prediction.topScorelines).toHaveLength(5);
    expect(prediction.strategyPicks.SAFE).toBeTruthy();
    expect(prediction.strategyPicks.BALANCED).toBeTruthy();
    expect(prediction.strategyPicks.AGGRESSIVE).toBeTruthy();
  });
});
