import SmashTournamentELO from "@/components/SmashTournamentELO";
import { Suspense } from "react";

export default function TierlistPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SmashTournamentELO defaultTab="tiers" />
    </Suspense>
  );
}
