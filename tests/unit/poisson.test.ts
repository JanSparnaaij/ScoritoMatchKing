import { describe, expect, it } from "vitest";
import { estimateExpectedGoals, scorelineMatrix } from "@/domain/poisson";

describe("poisson model", () => {
  it("builds a matrix with probabilities greater than zero", () => {
    const xg = estimateExpectedGoals({ homeWin: 0.42, draw: 0.28, awayWin: 0.3 }, 0.57);
    const matrix = scorelineMatrix(xg.home, xg.away, 5);

    const sum = matrix.reduce((accumulator, row) => accumulator + row.probability, 0);
    expect(sum).toBeGreaterThan(0.9);
    expect(sum).toBeLessThan(1);
  });
});
