import { prisma } from "../lib/prisma";

(async () => {
  const matches = await prisma.match.findMany({
    include: {
      competition: true,
      homeTeam: true,
      awayTeam: true,
      oddsSnapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
    },
    orderBy: { kickoffUtc: "asc" },
  });

  console.log(`Total matches in DB: ${matches.length}`);
  console.log();

  for (const m of matches) {
    const odds = m.oddsSnapshots[0];
    const oddsStr = odds ? `1:${odds.oneXTwoHome} X:${odds.oneXTwoDraw} 2:${odds.oneXTwoAway}` : "geen odds";
    console.log(
      `${m.kickoffUtc.toISOString().slice(0, 16)}  ${m.competition.gameVariant.padEnd(11)}  ${m.competition.name.padEnd(30)}  ${m.homeTeam.name} vs ${m.awayTeam.name}  ${oddsStr}`,
    );
  }

  await prisma.$disconnect();
})();
