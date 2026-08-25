import { describe, expect, it } from "vitest";
import { normalizedProbabilitiesFromOneXTwo } from "@/domain/odds";

describe("odds normalization", () => {
  it("normalizes 1X2 odds to a probability sum close to one", () => {
    const probabilities = normalizedProbabilitiesFromOneXTwo({
      home: 2.2,
      draw: 3.4,
      away: 3.1,
    });

    const total = probabilities.homeWin + probabilities.draw + probabilities.awayWin;
    expect(total).toBeCloseTo(1, 6);
  });
});
