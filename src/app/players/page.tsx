import SmashTournamentELO from "@/components/SmashTournamentELO";
import { Suspense } from "react";

export default function PlayersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SmashTournamentELO defaultTab="players" />
    </Suspense>
  );
}
