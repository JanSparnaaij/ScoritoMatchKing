import { GameVariant } from "@/domain/enums";
import { GamePageContent } from "@/app/_components/game-page-content";

type PageProps = {
  searchParams?: Promise<{
    round?: string;
  }>;
};

export default async function MatchKingIntPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsedRound = Number.parseInt(params?.round ?? "", 10);
  const selectedRound = Number.isFinite(parsedRound) && parsedRound > 0 ? parsedRound : undefined;

  return (
    <GamePageContent
      variant={GameVariant.INT}
      title="Match King INT"
      subtitle="Topcompetities: La Liga (Spanje), Premier League, Bundesliga, Ligue 1 en Serie A met voorspellingen en doelpuntenmakers per ronde."
      selectedRound={selectedRound}
    />
  );
}