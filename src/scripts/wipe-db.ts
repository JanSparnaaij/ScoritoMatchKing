import { prisma } from "../lib/prisma";

(async () => {
  console.log("Wiping matches, odds, predictions, syncjobs...");

  await prisma.$transaction([
    prisma.prediction.deleteMany({}),
    prisma.oddsSnapshot.deleteMany({}),
    prisma.match.deleteMany({}),
    prisma.competition.deleteMany({}),
    prisma.team.deleteMany({}),
    prisma.syncJob.deleteMany({}),
  ]);

  console.log("Done. Neon is nu leeg.");
  await prisma.$disconnect();
})();
