import SmashTournamentELO from "@/components/SmashTournamentELO";
import { Suspense } from "react";

export default function MatchesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SmashTournamentELO defaultTab="matches" />
    </Suspense>
  );
}
