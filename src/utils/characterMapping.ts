// Character mapping from display names to SVG file names
// Based on https://github.com/marcrd/smash-ultimate-assets/tree/master/stock-icons/svg

export const characterToFileMapping: Record<string, string> = {
  // Base roster - Updated to match actual GitHub repository file names
  MARIO: "mario",
  "DONKEY KONG": "donkey_kong",
  LINK: "link",
  SAMUS: "samus",
  "DARK SAMUS": "dark_samus",
  YOSHI: "yoshi",
  KIRBY: "kirby",
  FOX: "fox",
  PIKACHU: "pikachu",
  LUIGI: "luigi",
  NESS: "ness",
  "CAPTAIN FALCON": "captain_falcon",
  JIGGLYPUFF: "jigglypuff",
  PEACH: "peach",
  DAISY: "daisy",
  BOWSER: "bowser",
  "ICE CLIMBERS": "ice_climbers",
  SHEIK: "sheik",
  ZELDA: "zelda",
  "DR. MARIO": "dr_mario",
  PICHU: "pichu",
  FALCO: "falco",
  MARTH: "marth",
  LUCINA: "lucina",
  "YOUNG LINK": "young_link",
  GANONDORF: "ganondorf",
  MEWTWO: "mewtwo",
  ROY: "roy",
  CHROM: "chrom",
  ROB: "r_o_b",
  "MR. GAME & WATCH": "mr_game_and_watch",
  "META KNIGHT": "meta_knight",
  PIT: "pit",
  "DARK PIT": "dark_pit",
  "ZERO SUIT SAMUS": "zero_suit_samus",
  WARIO: "wario",
  SNAKE: "snake",
  IKE: "ike",
  "POKEMON TRAINER": "pokemon_trainer",
  "DIDDY KONG": "diddy_kong",
  LUCAS: "lucas",
  SONIC: "sonic",
  "KING DEDEDE": "king_dedede",
  OLIMAR: "olimar",
  LUCARIO: "lucario",
  "R.O.B.": "r_o_b",
  "TOON LINK": "toon_link",
  WOLF: "wolf",
  VILLAGER: "villager",
  "MEGA MAN": "mega_man",
  "WII FIT TRAINER": "wii_fit_trainer",
  "ROSALINA & LUMA": "rosalina_and_luma",
  "LITTLE MAC": "little_mac",
  GRENINJA: "greninja",
  // Mii Fighters use a single file in the repository
  "MII BRAWLER": "mii_fighter",
  "MII SWORDFIGHTER": "mii_fighter",
  "MII GUNNER": "mii_fighter",
  PALUTENA: "palutena",
  "PAC-MAN": "pac_man",
  ROBIN: "robin",
  SHULK: "shulk",
  "BOWSER JR.": "bowser_jr",
  "DUCK HUNT": "duck_hunt",
  RYU: "ryu",
  KEN: "ken",
  CLOUD: "cloud",
  CORRIN: "corrin",
  BAYONETTA: "bayonetta",

  // DLC characters that are available in the repository
  INKLING: "inkling",
  RIDLEY: "ridley",
  SIMON: "simon",
  RICHTER: "richter",
  "KING K. ROOL": "king_k_rool",
  ISABELLE: "isabelle",
  INCINEROAR: "incineroar",
  "PIRANHA PLANT": "piranha-plant", // Updated to match filename

  // DLC characters now available in local SVG folder
  STEVE: "steve",
  JOKER: "joker",
  HERO: "hero",
  "BANJO & KAZOOIE": "banjo_and_kazooie",
  TERRY: "Terry", // Note: capital T in filename
  BYLETH: "byleth",
  "MIN MIN": "min_min",
  SEPHIROTH: "sephiroth",
  PYRA: "homura", // Pyra's Japanese name in filename
  MYTHRA: "homura", // Both Pyra and Mythra use same file
  KAZUYA: "kazuya",
  SORA: "sora",
};

export function getCharacterIcon(characterName: string): string {
  const normalizedName = normalizeCharacterName(characterName);
  const fileName = characterToFileMapping[normalizedName];
  if (!fileName) {
    console.warn(
      `Character icon not found for: ${characterName} (normalized: ${normalizedName})`
    );
    return "/images/svgs/mario.svg"; // fallback to mario icon
  }
  return `/images/svgs/${fileName}.svg`;
}

export function getCharacterIconUrl(characterName: string): string {
  const normalizedName = normalizeCharacterName(characterName);
  const fileName = characterToFileMapping[normalizedName];
  if (!fileName) {
    return "/images/svgs/mario.svg"; // fallback to mario icon
  }
  return `/images/svgs/${fileName}.svg`;
}

// Helper function to normalize character names (handle ALL CAPS, etc.)
export function normalizeCharacterName(characterName: string): string {
  if (!characterName) return "";

  // Convert to uppercase for lookup
  const upperCase = characterName
    .toLowerCase()
    .split(" ")
    .map((word) => {
      // Handle special cases
      if (word === "and") return "&";
      if (word === "r.o.b.") return "R.O.B.";
      if (word === "mr.") return "MR.";
      if (word === "dr.") return "DR.";
      if (word === "jr.") return "JR.";

      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .toUpperCase();

  // Handle special character name mappings
  const specialMappings: Record<string, string> = {
    // Minecraft skins map to Steve
    ENDERMAN: "STEVE",
    STEVE: "STEVE",
    ALEX: "STEVE",
    ZOMBIE: "STEVE",
    "R.O.B.": "R.O.B.",
    "MR. GAME & WATCH": "MR. GAME & WATCH",
    // Characters that might be stored differently in the database
    "KING K ROOL": "KING K. ROOL",
    "KING K. ROOL": "KING K. ROOL",
    ROSALINA: "ROSALINA & LUMA",
  };

  return specialMappings[upperCase] || upperCase;
}
