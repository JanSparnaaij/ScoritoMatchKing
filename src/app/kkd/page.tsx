import { GameVariant } from "@/domain/enums";
import { GamePageContent } from "@/app/_components/game-page-content";

type PageProps = {
  searchParams?: Promise<{
    round?: string;
  }>;
};

export default async function MatchKingKkdPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsedRound = Number.parseInt(params?.round ?? "", 10);
  const selectedRound = Number.isFinite(parsedRound) && parsedRound > 0 ? parsedRound : undefined;

  return (
    <GamePageContent
      variant={GameVariant.KKD}
      title="Match King KKD"
      subtitle="Keuken Kampioen Divisie wedstrijden met voorspellingen en doelpuntenmakers per ronde."
      selectedRound={selectedRound}
    />
  );
}
