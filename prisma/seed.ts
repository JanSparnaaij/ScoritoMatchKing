import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const eredivisie = await prisma.competition.upsert({
    where: { code: "NL-EREDIVISIE" },
    create: { code: "NL-EREDIVISIE", name: "Eredivisie", gameVariant: "NL" },
    update: {},
  });

  await prisma.team.upsert({
    where: { id: "ajax-team" },
    create: { id: "ajax-team", name: "Ajax" },
    update: {},
  });

  await prisma.team.upsert({
    where: { id: "psv-team" },
    create: { id: "psv-team", name: "PSV" },
    update: {},
  });

  const match = await prisma.match.create({
    data: {
      competitionId: eredivisie.id,
      homeTeamId: "ajax-team",
      awayTeamId: "psv-team",
      kickoffUtc: new Date("2026-08-08T18:00:00.000Z"),
    },
  });

  await prisma.oddsSnapshot.create({
    data: {
      matchId: match.id,
      roundCode: "seed-round",
      oneXTwoHome: 2.55,
      oneXTwoDraw: 3.5,
      oneXTwoAway: 2.7,
      over25: 1.72,
      under25: 2.18,
      bttsYes: 1.66,
      bttsNo: 2.2,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
