import SmashTournamentELO from "@/components/SmashTournamentELO";
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SmashTournamentELO defaultTab="rankings" />
    </Suspense>
  );
}
