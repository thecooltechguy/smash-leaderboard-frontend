"use client";

import { Player } from "@/lib/prisma";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "@headlessui/react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Filter,
  List,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { memo, useEffect, useRef, useState } from "react";
import ReactCountryFlag from "react-country-flag";

// Extended player interface for frontend with real stats
interface ExtendedPlayer extends Omit<Player, "id" | "elo"> {
  id: number;
  elo: number;
  matches: number;
  is_ranked: boolean;
  top_10_players_played: number;
  main_character?: string;
  total_wins?: number;
  total_losses?: number;
  total_kos?: number;
  total_falls?: number;
  total_sds?: number;
  current_win_streak?: number;
}

// Match participant interface
interface MatchParticipant {
  id: number;
  player: number;
  player_name: string;
  player_display_name: string | null;
  player_is_ranked: boolean;
  smash_character: string;
  is_cpu: boolean;
  total_kos: number;
  total_falls: number;
  total_sds: number;
  has_won: boolean;
}

// Match interface
interface Match {
  id: number;
  created_at: string;
  participants: MatchParticipant[];
}

type Tier = "S" | "A" | "B" | "C" | "D" | "E";

// Memoized component for refresh status to prevent unnecessary rerendersO
const RefreshStatus = memo(
  ({
    refreshing,
    countdown,
    lastUpdated,
    centered = false,
    autoRefreshDisabled = false,
  }: {
    refreshing: boolean;
    countdown: number;
    lastUpdated: Date | null;
    centered?: boolean;
    autoRefreshDisabled?: boolean;
  }) => {
    if (!lastUpdated) return null;

    return (
      <div
        className={`text-sm text-gray-200 mt-1 flex items-center ${
          centered ? "justify-center" : ""
        }`}
      >
        {refreshing ? (
          <>
            <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full mr-2"></div>
            Refreshing...
          </>
        ) : autoRefreshDisabled ? (
          <>
            <span className="mr-2 text-yellow-300">●</span>
            <span>Reload page to start auto refreshing</span>
          </>
        ) : (
          <>
            {/* <span>Last updated: {lastUpdated.toLocaleTimeString()}</span> */}
            {/* <span className="mx-2 text-gray-400">•</span> */}
            <span className="mr-2 text-green-300">●</span>
            <span>Refreshing in {countdown}s</span>
          </>
        )}
      </div>
    );
  }
);

RefreshStatus.displayName = "RefreshStatus";

// ProfilePicture component with zoom and translate effects
const ProfilePicture = memo(
  ({
    player,
    size = "md",
    borderColor = "border-gray-600",
    borderWidth = "border-2",
    additionalClasses = "",
  }: {
    player: ExtendedPlayer | { name: string; display_name: string | null };
    size?: "sm" | "md" | "lg" | "xl";
    borderColor?: string;
    borderWidth?: string;
    additionalClasses?: string;
  }) => {
    const sizeClasses = {
      sm: "h-10 w-10 md:h-10 md:w-10",
      md: "h-12 w-12 md:h-20 md:w-20",
      lg: "h-16 w-16 md:h-20 md:w-20",
      xl: "h-24 w-24",
    };

    const textSizeClasses = {
      sm: "text-xs",
      md: "text-xs md:text-lg",
      lg: "text-lg md:text-2xl",
      xl: "text-2xl",
    };

    const getProfilePicture = (
      player: ExtendedPlayer | { name: string; display_name: string | null }
    ): string | null => {
      const nameToUse = (player.display_name || player.name).toLowerCase();

      if (nameToUse.includes("habeas") || nameToUse.includes("haseab"))
        return "/images/habeas.png";
      if (nameToUse.includes("subby")) return "/images/subby.png";
      if (nameToUse.includes("pat")) return "/images/pat.png";
      if (nameToUse.includes("will")) return "/images/will.png";
      if (nameToUse.includes("ryy")) return "/images/ryy.png";
      if (nameToUse.includes("jmoon")) return "/images/jmoon.png";
      if (nameToUse.includes("keneru")) return "/images/keneru.png";
      if (nameToUse.includes("rp")) return "/images/ryanp.png";
      if (nameToUse.includes("samin")) return "/images/samin.png";
      if (nameToUse.includes("stav")) return "/images/stav.png";
      if (nameToUse.includes("ya")) return "/images/ya.png";
      if (nameToUse.includes("shafaq")) return "/images/shafaq.png";
      if (nameToUse.includes("david")) return "/images/david.png";
      if (nameToUse.includes("bihan")) return "/images/bihan.png";
      if (nameToUse.includes("kento")) return "/images/kento.png";
      if (nameToUse.includes("jackedson")) return "/images/jackedson.png";
      if (nameToUse.includes("nish")) return "/images/nish.png";

      return null;
    };

    const getInitials = (
      player: ExtendedPlayer | { name: string; display_name: string | null }
    ): string => {
      const nameToUse = player.display_name || player.name;
      return nameToUse
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase();
    };

    const profilePic = getProfilePicture(player);

    const isRoundedLg = additionalClasses.includes("rounded-lg");
    const roundedClass = isRoundedLg ? "rounded-lg" : "rounded-full";

    if (profilePic) {
      return (
        <div
          className={`${sizeClasses[size]} ${roundedClass} overflow-hidden ${borderWidth} ${borderColor} ${additionalClasses}`}
        >
          <img
            src={profilePic}
            alt={player.display_name || player.name}
            className="w-full h-full object-cover"
          />
        </div>
      );
    }

    const bgColor = additionalClasses.includes("bg-") ? "" : "bg-gray-700";

    return (
      <div
        className={`${sizeClasses[size]} ${roundedClass} ${bgColor} flex items-center justify-center ${borderWidth} ${borderColor} ${additionalClasses}`}
      >
        <span className={`${textSizeClasses[size]} font-bold text-white`}>
          {getInitials(player)}
        </span>
      </div>
    );
  }
);

ProfilePicture.displayName = "ProfilePicture";

// Fire streak component for win streaks
const FireStreak = memo(({ streak }: { streak: number }) => {
  if (streak < 3) return null;

  const getBadgeStyles = (streak: number) => {
    if (streak >= 10) {
      return {
        bg: "bg-purple-500/20",
        border: "border-purple-500/50",
        text: "text-purple-300",
        glow: "shadow-[0_0_10px_rgba(168,85,247,0.3)]",
      };
    }
    if (streak >= 5) {
      return {
        bg: "bg-blue-500/20",
        border: "border-blue-500/50",
        text: "text-blue-300",
        glow: "shadow-[0_0_10px_rgba(59,130,246,0.3)]",
      };
    }
    return {
      bg: "bg-orange-500/20",
      border: "border-orange-500/50",
      text: "text-orange-300",
      glow: "shadow-[0_0_10px_rgba(251,146,60,0.3)]",
    };
  };

  const styles = getBadgeStyles(streak);

  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 ml-1 md:px-2 md:py-0.5 md:ml-2 rounded-full border text-xs md:text-xs font-semibold animate-pulse ${styles.bg} ${styles.border} ${styles.text} ${styles.glow}`}
    >
      <span className="text-xs md:text-sm">🔥</span>
      <span>{streak}</span>
    </div>
  );
});

FireStreak.displayName = "FireStreak";

// MultiSelect Dropdown Component
interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  label: string;
}

const MultiSelect = memo(
  ({ options, selected, onChange, placeholder, label }: MultiSelectProps) => {
    return (
      <div className="relative">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          {label} ({selected.length} selected)
        </label>
        <Listbox value={selected} onChange={onChange} multiple>
          <div className="relative">
            <ListboxButton className="relative w-full cursor-pointer rounded-lg bg-gray-700 border border-gray-600 py-2 pl-3 pr-10 text-left text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-600 transition-colors duration-200">
              <span className="block truncate">
                {selected.length === 0 ? (
                  <span className="text-gray-400">{placeholder}</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {selected.slice(0, 2).map((value) => (
                      <span
                        key={value}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-md"
                      >
                        {options.find((opt) => opt.value === value)?.label ||
                          value}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            onChange(selected.filter((s) => s !== value));
                          }}
                          className="ml-1 hover:bg-blue-700 rounded cursor-pointer"
                        >
                          <X size={12} />
                        </span>
                      </span>
                    ))}
                    {selected.length > 2 && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-600 text-white rounded-md">
                        +{selected.length - 2} more
                      </span>
                    )}
                  </div>
                )}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronDown
                  className="h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
              </span>
            </ListboxButton>
            <Transition
              as={React.Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <ListboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-gray-700 border border-gray-600 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                {options.map((option) => (
                  <ListboxOption
                    key={option.value}
                    value={option.value}
                    className="relative cursor-pointer select-none py-2 pl-10 pr-4 data-[focus]:bg-gray-600 data-[focus]:text-white text-gray-300"
                  >
                    {({ selected: optionSelected }) => (
                      <>
                        <span
                          className={`block truncate ${
                            optionSelected ? "font-medium" : "font-normal"
                          }`}
                        >
                          {option.label}
                        </span>
                        {optionSelected && (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-400">
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </span>
                        )}
                      </>
                    )}
                  </ListboxOption>
                ))}
              </ListboxOptions>
            </Transition>
          </div>
        </Listbox>
      </div>
    );
  }
);

MultiSelect.displayName = "MultiSelect";

interface SmashTournamentELOProps {
  defaultTab?: "tiers" | "rankings" | "matches" | "players";
}

export default function SmashTournamentELO({
  defaultTab = "rankings",
}: SmashTournamentELOProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State management
  const [players, setPlayers] = useState<ExtendedPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab] = useState<"tiers" | "rankings" | "matches" | "players">(
    defaultTab
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(30);

  // Cache management
  const [playersCache, setPlayersCache] = useState<{
    data: ExtendedPlayer[];
    timestamp: number;
  } | null>(null);
  const CACHE_DURATION = 30000; // 30 seconds
  const [matchesPage, setMatchesPage] = useState<number>(1);
  const [loadingMoreMatches, setLoadingMoreMatches] = useState<boolean>(false);
  const [hasMoreMatches, setHasMoreMatches] = useState<boolean>(true);
  const [selectedPlayerFilter, setSelectedPlayerFilter] = useState<string[]>(
    []
  );
  const [selectedCharacterFilter, setSelectedCharacterFilter] = useState<
    string[]
  >([]);
  const [only1v1, setOnly1v1] = useState<boolean>(false);
  const [autoRefreshDisabled, setAutoRefreshDisabled] =
    useState<boolean>(false);
  const [rankedFilter, setRankedFilter] = useState<string>("all"); // "all", "ranked", "unranked"
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [leaderboardTab, setLeaderboardTab] = useState<"ranked" | "unranked">(
    "ranked"
  );
  const [showUtcTime, setShowUtcTime] = useState<boolean>(false);
  const [refreshingMatches, setRefreshingMatches] = useState<Set<number>>(
    new Set()
  );

  // Helper function to validate country code
  const isValidCountryCode = (countryCode: string | null): boolean => {
    if (!countryCode) return false;
    return /^[A-Z]{2}$/.test(countryCode.toUpperCase());
  };

  // Initialize filters from URL params on matches page
  useEffect(() => {
    if (defaultTab === "matches") {
      const players = searchParams.getAll("player");
      const characters = searchParams.getAll("character");
      const only1v1Param = searchParams.get("only1v1") === "true";
      const rankedParam = searchParams.get("ranked");

      if (players.length > 0) {
        setSelectedPlayerFilter(players);
        setShowFilters(true);
      }
      if (characters.length > 0) {
        setSelectedCharacterFilter(characters);
        setShowFilters(true);
      }
      if (only1v1Param) {
        setOnly1v1(true);
        setShowFilters(true);
      }
      if (rankedParam && ["ranked", "unranked"].includes(rankedParam)) {
        setRankedFilter(rankedParam);
        setShowFilters(true);
      }
    }
  }, [defaultTab, searchParams]);

  // Refs to store current filter values for use in intervals
  const currentPlayerFilter = useRef<string[]>([]);
  const currentCharacterFilter = useRef<string[]>([]);
  const current1v1Filter = useRef<boolean>(false);
  const currentRankedFilter = useRef<string>("all");
  const currentActiveTab = useRef<string>("rankings");
  const currentAutoRefreshDisabled = useRef<boolean>(false);

  // Update refs when state changes
  useEffect(() => {
    currentPlayerFilter.current = selectedPlayerFilter;
  }, [selectedPlayerFilter]);

  useEffect(() => {
    currentCharacterFilter.current = selectedCharacterFilter;
  }, [selectedCharacterFilter]);

  useEffect(() => {
    current1v1Filter.current = only1v1;
  }, [only1v1]);

  useEffect(() => {
    currentRankedFilter.current = rankedFilter;
  }, [rankedFilter]);

  useEffect(() => {
    currentActiveTab.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    currentAutoRefreshDisabled.current = autoRefreshDisabled;
  }, [autoRefreshDisabled]);

  // Function to handle tab navigation
  const handleTabClick = (tabId: string) => {
    switch (tabId) {
      case "rankings":
        router.push("/");
        break;
      case "tiers":
        router.push("/tierlist");
        break;
      case "matches":
        router.push("/matches");
        break;
      case "players":
        router.push("/players");
        break;
    }
  };

  // Function to handle player click and scroll
  const handlePlayerClick = (playerId: number) => {
    router.push(`/players#player-${playerId}`);
  };

  // Function to add highlight effect to player profile after scrolling
  const highlightPlayerProfile = (playerId: number) => {
    const element = document.getElementById(`player-${playerId}`);
    if (element) {
      // Add highlight class
      element.classList.add("player-highlight");

      // Remove highlight after 3 seconds
      setTimeout(() => {
        element.classList.remove("player-highlight");
      }, 3000);
    }
  };

  // Load Google Font
  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Calculate percentile-based tier thresholds
  const calculateTierThresholds = (sortedPlayers: ExtendedPlayer[]) => {
    if (sortedPlayers.length === 0) {
      return { S: 2000, A: 1800, B: 1600, C: 1400, D: 1200, E: 1000 };
    }

    // Get all ELO scores in ascending order for percentile calculation
    const ascendingElos = [...sortedPlayers]
      .sort((a, b) => a.elo - b.elo)
      .map((p) => p.elo);

    // Function to calculate percentile value from ELO scores
    const getPercentile = (percentile: number): number => {
      const index = (percentile / 100) * (ascendingElos.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);

      if (lower === upper) {
        return ascendingElos[lower];
      }

      // Linear interpolation between the two closest values
      const weight = index - lower;
      return (
        ascendingElos[lower] * (1 - weight) + ascendingElos[upper] * weight
      );
    };

    return {
      S: getPercentile(90), // 90th percentile and above = S tier (top 10%)
      A: getPercentile(75), // 75th percentile and above = A tier or higher
      B: getPercentile(50), // 50th percentile and above = B tier or higher
      C: getPercentile(25), // 25th percentile and above = C tier or higher
      D: getPercentile(10), // 10th percentile and above = D tier or higher
      E: Math.min(...ascendingElos), // Everyone else is E tier
    };
  };

  // Update URL with filter parameters for matches
  const updateMatchesURL = (
    playerFilter: string[],
    characterFilter: string[],
    only1v1Filter: boolean
  ) => {
    if (defaultTab === "matches") {
      const params = new URLSearchParams();

      playerFilter.forEach((player) => params.append("player", player));
      characterFilter.forEach((character) =>
        params.append("character", character)
      );
      if (only1v1Filter) params.append("only1v1", "true");

      const queryString = params.toString();
      const newUrl = queryString ? `/matches?${queryString}` : "/matches";

      // Use replace to avoid adding to history stack
      router.replace(newUrl);
    }
  };

  // Fetch players from database with caching
  useEffect(() => {
    // Check if we need fresh data
    const checkFreshData = () => {
      // Check memory cache first
      if (
        playersCache &&
        Date.now() - playersCache.timestamp <= CACHE_DURATION
      ) {
        return false;
      }

      // Check localStorage cache
      try {
        const cached = localStorage.getItem("playersCache");
        if (cached) {
          const parsedCache = JSON.parse(cached);
          if (Date.now() - parsedCache.timestamp <= CACHE_DURATION) {
            // Update memory cache from localStorage
            setPlayersCache(parsedCache);
            return false;
          }
        }
      } catch {
        // If localStorage fails, continue with fresh fetch
      }

      return true;
    };

    // Only fetch if we don't have cached data or it's stale
    if (checkFreshData()) {
      fetchPlayers();
    } else {
      // Use cached data (from memory or localStorage)
      const cacheToUse =
        playersCache ||
        JSON.parse(localStorage.getItem("playersCache") || "{}");
      if (cacheToUse.data) {
        setPlayers(cacheToUse.data);
        setLoading(false);
        setLastUpdated(new Date(cacheToUse.timestamp));
        if (!playersCache) {
          setPlayersCache(cacheToUse);
        }

        // Check for hash scroll when using cached data
        const hash = window.location.hash;
        if (hash.startsWith("#player-")) {
          const playerId = parseInt(hash.replace("#player-", ""));
          setTimeout(() => {
            const element = document.getElementById(`player-${playerId}`);
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "center" });
              // Highlight the profile after scrolling
              setTimeout(() => highlightPlayerProfile(playerId), 500);
            }
          }, 200); // Increased timeout for cached data
        }
      } else {
        // Fallback to fetch if cache is corrupted
        fetchPlayers();
      }
    }

    // Only fetch matches for matches tab
    if (defaultTab === "matches") {
      const players = searchParams.getAll("player");
      const characters = searchParams.getAll("character");
      const only1v1Param = searchParams.get("only1v1") === "true";
      fetchMatches(1, false, players, characters, only1v1Param);
    }

    // Set up automatic refresh every 30 seconds - but only run for current active tab
    const refreshInterval = setInterval(() => {
      // Only refresh if this component is for the current active tab
      if (currentActiveTab.current === defaultTab) {
        // For matches tab, only refresh if auto-refresh is not disabled
        if (defaultTab === "matches" && currentAutoRefreshDisabled.current) {
          // Skip all refresh activity when auto-refresh is disabled for matches
          return;
        }

        fetchPlayers(true);
        if (defaultTab === "matches") {
          fetchMatches(
            1,
            false,
            currentPlayerFilter.current,
            currentCharacterFilter.current,
            current1v1Filter.current
          );
          setMatchesPage(1);
        }
      }

      // Only update countdown if not in disabled state for matches tab
      if (!(defaultTab === "matches" && currentAutoRefreshDisabled.current)) {
        setCountdown(30);
      }
    }, 30000);

    // Set up countdown timer every second
    const countdownInterval = setInterval(() => {
      // Don't update countdown if auto-refresh is disabled for matches tab
      if (defaultTab === "matches" && currentAutoRefreshDisabled.current) {
        return;
      }

      setCountdown((prev) => {
        if (prev <= 1) {
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup intervals on component unmount
    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTab, searchParams]);

  const fetchPlayers = async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/players");
      if (!response.ok) {
        throw new Error("Failed to fetch players");
      }
      const data: Array<{
        id: number;
        name: string;
        display_name: string | null;
        elo: number;
        is_ranked: boolean;
        top_10_players_played: number;
        created_at: string;
        main_character?: string;
        total_wins?: number;
        total_losses?: number;
      }> = await response.json();

      // Process players with real stats from database
      const playersWithMatches = data.map((player) => ({
        ...player,
        matches: (player.total_wins || 0) + (player.total_losses || 0),
      }));

      setPlayers(playersWithMatches);
      const now = new Date();
      setLastUpdated(now);

      // Update cache
      const cacheData = {
        data: playersWithMatches,
        timestamp: now.getTime(),
      };
      setPlayersCache(cacheData);

      // Also cache in localStorage
      try {
        localStorage.setItem("playersCache", JSON.stringify(cacheData));
      } catch {
        // If localStorage fails, continue without caching
      }

      // Check for hash after players are loaded
      const hash = window.location.hash;
      if (hash.startsWith("#player-")) {
        const playerId = parseInt(hash.replace("#player-", ""));
        setTimeout(() => {
          const element = document.getElementById(`player-${playerId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            // Highlight the profile after scrolling
            setTimeout(() => highlightPlayerProfile(playerId), 500);
          }
        }, 200);
      }
    } catch (err) {
      console.error("Error fetching players:", err);
      setError("Failed to load players. Please try again later.");
    } finally {
      if (!isBackgroundRefresh) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  const fetchMatches = async (
    page: number = 1,
    append: boolean = false,
    playerFilter?: string[],
    characterFilter?: string[],
    only1v1Filter?: boolean
  ) => {
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "20");

      if (playerFilter && playerFilter.length > 0) {
        playerFilter.forEach((player) => params.append("player", player));
      }
      if (characterFilter && characterFilter.length > 0) {
        characterFilter.forEach((character) =>
          params.append("character", character)
        );
      }
      if (only1v1Filter) {
        params.append("only1v1", "true");
      }

      const url = `/api/matches?${params.toString()}`;
      console.log("Fetching matches from:", url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch matches");
      }
      const data = await response.json();
      console.log("Received data:", data);

      // Handle both old format (direct array) and new format (object with matches and pagination)
      let matches: Match[];
      let hasMore = false;

      if (Array.isArray(data)) {
        // Old format compatibility
        matches = data;
        hasMore = data.length === 20;
      } else {
        // New format
        matches = data.matches || [];
        hasMore = data.pagination?.hasMore || false;
      }

      if (append) {
        console.log(
          "Appending matches:",
          matches.length,
          "to existing:",
          matches.length
        );
        setMatches((prev) => [...prev, ...matches]);
      } else {
        console.log("Setting matches:", matches.length, "matches");
        setMatches(matches);
      }

      setHasMoreMatches(hasMore);
      console.log("Updated matches state, hasMore:", hasMore);
    } catch (err) {
      console.error("Error fetching matches:", err);
      // Don't set error state for matches as it's secondary to players
    }
  };

  const loadMoreMatches = async () => {
    if (loadingMoreMatches || !hasMoreMatches) return;

    setAutoRefreshDisabled(true);
    setLoadingMoreMatches(true);
    const nextPage = matchesPage + 1;
    await fetchMatches(
      nextPage,
      true,
      selectedPlayerFilter,
      selectedCharacterFilter,
      only1v1
    );
    setMatchesPage(nextPage);
    setLoadingMoreMatches(false);
  };

  // Function to refresh a single match
  const refreshSingleMatch = async (matchId: number) => {
    try {
      // Add match ID to refreshing set
      setRefreshingMatches((prev) => new Set(prev).add(matchId));

      const response = await fetch(`/api/matches/${matchId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch match");
      }

      const updatedMatch = await response.json();

      // Update only this match in the matches array
      setMatches((prev) =>
        prev.map((match) => (match.id === matchId ? updatedMatch : match))
      );
    } catch (error) {
      console.error("Error refreshing match:", error);
    } finally {
      // Remove match ID from refreshing set
      setRefreshingMatches((prev) => {
        const newSet = new Set(prev);
        newSet.delete(matchId);
        return newSet;
      });
    }
  };

  // Search function to manually trigger filtering
  const handleSearch = async () => {
    console.log("handleSearch called with filters:", {
      player: selectedPlayerFilter,
      character: selectedCharacterFilter,
      only1v1: only1v1,
    });
    setMatchesPage(1);

    // Update URL with current filters
    updateMatchesURL(selectedPlayerFilter, selectedCharacterFilter, only1v1);

    await fetchMatches(
      1,
      false,
      selectedPlayerFilter,
      selectedCharacterFilter,
      only1v1
    );
  };

  // Determine tier based on ELO using percentile-based thresholds
  const getTier = (
    elo: number,
    tierThresholds: ReturnType<typeof calculateTierThresholds>
  ): Tier => {
    if (elo >= tierThresholds.S) return "S";
    if (elo >= tierThresholds.A) return "A";
    if (elo >= tierThresholds.B) return "B";
    if (elo >= tierThresholds.C) return "C";
    if (elo >= tierThresholds.D) return "D";
    return "E";
  };

  // Sort players by ELO
  const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);

  // Separate ranked and unranked players
  const rankedPlayers = sortedPlayers.filter((player) => player.is_ranked);
  const unrankedPlayers = sortedPlayers.filter((player) => !player.is_ranked);

  // Sort unranked players by how close they are to becoming ranked (descending: 2/3, 1/3, 0/3)
  const sortedUnrankedPlayers = unrankedPlayers.sort(
    (a, b) => b.top_10_players_played - a.top_10_players_played
  );

  // Calculate dynamic tier thresholds ONLY for ranked players
  const tierThresholds = calculateTierThresholds(rankedPlayers);

  // Get tier badge color
  const getTierBadgeColor = (tier: Tier): string => {
    switch (tier) {
      case "S":
        return "bg-gradient-to-r from-yellow-400 to-yellow-500 text-black";
      case "A":
        return "bg-gradient-to-r from-red-500 to-red-600 text-white";
      case "B":
        return "bg-gradient-to-r from-blue-500 to-blue-600 text-white";
      case "C":
        return "bg-gradient-to-r from-green-500 to-green-600 text-white";
      case "D":
        return "bg-gradient-to-r from-purple-500 to-purple-600 text-white";
      case "E":
        return "bg-gradient-to-r from-gray-500 to-gray-600 text-white";
      default:
        return "bg-gradient-to-r from-gray-500 to-gray-600 text-white";
    }
  };

  // Group players by tier for tier list (only ranked players)
  const tierList: Record<Tier, ExtendedPlayer[]> = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    E: [],
  };

  rankedPlayers.forEach((player) => {
    const tier = getTier(player.elo, tierThresholds);
    tierList[tier].push(player);
  });

  return (
    <>
      {/* CSS for player highlight effect */}
      <style jsx>{`
        .player-highlight {
          animation: highlight 3s ease-in-out;
          box-shadow: 0 0 20px rgba(255, 215, 0, 0.8),
            0 0 40px rgba(255, 215, 0, 0.4);
          border: 2px solid rgba(255, 215, 0, 0.6) !important;
        }

        @keyframes highlight {
          0% {
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.8),
              0 0 40px rgba(255, 215, 0, 0.4);
            border-color: rgba(255, 215, 0, 0.6);
          }
          50% {
            box-shadow: 0 0 30px rgba(255, 215, 0, 1),
              0 0 60px rgba(255, 215, 0, 0.6);
            border-color: rgba(255, 215, 0, 0.8);
          }
          100% {
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.8),
              0 0 40px rgba(255, 215, 0, 0.4);
            border-color: rgba(255, 215, 0, 0.6);
          }
        }
      `}</style>

      <div
        className="flex flex-col items-center p-6 md:p-0 min-h-screen bg-black text-white antialiased"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(30, 30, 30, 0.4) 0%, rgba(0, 0, 0, 0.8) 100%)",
          backgroundAttachment: "fixed",
          fontFamily: "'Roboto Mono', monospace",
        }}
      >
        {/* Smash-style header */}
        <header className="max-w-5xl w-full bg-gradient-to-r from-red-600 to-red-700 border-b-4 border-yellow-500 shadow-lg relative overflow-hidden rounded-3xl md:mt-8">
          {/* Glare effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>

          <div className="py-6 flex justify-center items-center relative z-10">
            <div className="flex items-center space-x-8">
              {/* Founders Inc Logo */}
              <img
                src="/images/founders-icon.png"
                alt="Founders Inc Logo"
                className="hidden md:block h-12 w-auto object-contain"
                style={{
                  filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))",
                }}
              />

              <h1
                className="hidden md:block text-5xl font-bold tracking-wide uppercase text-white"
                style={{
                  textShadow:
                    "0 0 15px rgba(255, 255, 255, 0.6), 3px 3px 6px rgba(0, 0, 0, 0.8)",
                  letterSpacing: "0.15em",
                }}
              >
                ×
              </h1>

              {/* Smash Bros Logo */}
              <img
                src="/images/smash-logo.png"
                alt="Super Smash Bros Logo"
                className="h-16 w-auto object-contain"
                style={{
                  filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))",
                }}
              />
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 shadow-md sticky top-0 z-50 mt-6 rounded-xl mx-4">
          <div className="">
            <ul className="flex rounded-xl overflow-hidden">
              {[
                {
                  id: "rankings",
                  icon: <Trophy size={20} />,
                  label: "Rankings",
                },
                { id: "tiers", icon: <List size={20} />, label: "Tier List" },
                { id: "matches", icon: <Swords size={20} />, label: "Matches" },
                { id: "players", icon: <Users size={20} />, label: "Players" },
              ].map((tab, index) => (
                <li key={tab.id} className="">
                  <button
                    onClick={() => handleTabClick(tab.id)}
                    className={`w-full px-2 py-3 md:px-4 md:py-5 flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-3 transition-all duration-200 relative overflow-hidden text-sm md:text-xl font-semibold ${
                      activeTab === tab.id
                        ? "bg-gradient-to-b from-red-600 to-red-700 text-white"
                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                    }`}
                    style={{
                      boxShadow:
                        activeTab === tab.id
                          ? "inset 0 -3px 0 rgba(255, 215, 0, 0.7)"
                          : "none",
                      borderRadius:
                        index === 0
                          ? "0.75rem 0 0 0.75rem"
                          : index === 3
                          ? "0 0.75rem 0.75rem 0"
                          : "0",
                    }}
                  >
                    {/* Glare effect for active tab */}
                    {activeTab === tab.id && (
                      <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>
                    )}

                    <span className="relative z-10">
                      <span className="block md:hidden">
                        {React.cloneElement(tab.icon, { size: 16 })}
                      </span>
                      <span className="hidden md:block">{tab.icon}</span>
                    </span>
                    <span className="relative z-10 text-xs md:text-xl">
                      {tab.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Main content */}
        <main className="max-w-5xl w-full py-3">
          {error && (
            <div className="bg-gradient-to-r from-red-600 to-red-700 border border-red-800 text-white px-4 py-3 rounded-xl mb-6 flex justify-between items-center shadow-lg">
              <span className="text-lg">{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-white hover:text-gray-200 rounded-full h-6 w-6 flex items-center justify-center bg-red-800"
              >
                &times;
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div
                className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-500"
                style={{
                  boxShadow: "0 0 20px rgba(255, 215, 0, 0.5)",
                }}
              ></div>
            </div>
          ) : (
            <>
              {/* Rankings Tab */}
              {activeTab === "rankings" && (
                <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-lg relative">
                  {/* Loading overlay when refreshing */}
                  {refreshing && (
                    <div className="absolute inset-0 bg-black bg-opacity-20 z-10 flex items-center justify-center backdrop-blur-sm">
                      <div className="bg-gray-800 bg-opacity-90 px-6 py-3 rounded-full flex items-center space-x-3 border border-gray-600">
                        <div className="animate-spin h-5 w-5 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                        <span className="text-white font-medium">
                          Updating rankings...
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between relative overflow-hidden rounded-t-2xl">
                    {/* Glare effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>

                    <div className="flex flex-col md:flex-row items-center relative z-10 justify-between w-full">
                      <div className="flex items-center space-x-2">
                        <Trophy
                          className="mr-3 text-yellow-500"
                          size={24}
                          style={{
                            filter:
                              "drop-shadow(0 0 5px rgba(255, 215, 0, 0.5))",
                          }}
                        />
                        <div>
                          <h2
                            className="text-2xl font-bold text-white"
                            style={{
                              textShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
                            }}
                          >
                            Leaderboard
                          </h2>
                        </div>
                      </div>
                      <RefreshStatus
                        refreshing={refreshing}
                        countdown={countdown}
                        lastUpdated={lastUpdated}
                        centered={false}
                      />
                    </div>
                  </div>

                  {/* Leaderboard Sub-tabs */}
                  <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
                    <div className="flex space-x-1">
                      {[
                        { id: "ranked", label: "Ranked Players" },
                        { id: "unranked", label: "Unranked Players" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() =>
                            setLeaderboardTab(tab.id as "ranked" | "unranked")
                          }
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                            leaderboardTab === tab.id
                              ? "bg-red-600 text-white"
                              : "text-gray-400 hover:text-white hover:bg-gray-700"
                          }`}
                        >
                          {tab.label}
                          <span className="ml-2 text-xs bg-gray-600 px-2 py-1 rounded-full">
                            {tab.id === "ranked"
                              ? rankedPlayers.length
                              : unrankedPlayers.length}
                          </span>
                        </button>
                      ))}
                    </div>
                    {leaderboardTab === "unranked" && (
                      <div className="mt-2 text-sm text-gray-400">
                        Sorted by progress toward ranking (need to play 3+ top
                        10 players)
                      </div>
                    )}
                  </div>

                  {sortedPlayers.length === 0 ? (
                    <div className="text-gray-400 text-center py-16 px-6">
                      <p className="text-2xl font-bold">
                        No fighters have entered the arena yet!
                      </p>
                      <p className="mt-2 text-lg">
                        Add some fighters to begin the tournament
                      </p>
                    </div>
                  ) : (
                    <div
                      className={`p-6 transition-opacity duration-300 ${
                        refreshing ? "opacity-75" : "opacity-100"
                      }`}
                    >
                      <div className="overflow-hidden rounded-xl">
                        <table className="w-full divide-y divide-gray-800">
                          <thead>
                            <tr className="bg-gradient-to-r from-gray-800 to-gray-700">
                              <th className="px-2 py-3 md:px-6 md:py-6 text-left text-xs md:text-lg font-bold text-gray-300 uppercase tracking-wider rounded-tl-xl w-24">
                                {leaderboardTab === "ranked"
                                  ? "Rank"
                                  : "Progress"}
                              </th>
                              <th className="px-1 py-3 md:px-2 md:py-6 text-center text-xs md:text-lg font-bold text-gray-300 uppercase tracking-wider w-12">
                                Flag
                              </th>
                              <th className="px-2 py-3 md:px-6 md:py-6 text-left text-xs md:text-lg font-bold text-gray-300 uppercase tracking-wider">
                                Player
                              </th>
                              {leaderboardTab === "ranked" && (
                                <th className="px-2 py-3 md:px-6 md:py-6 text-left text-xs md:text-lg font-bold text-gray-300 uppercase tracking-wider w-32">
                                  <div className="flex items-center">
                                    <span>ELO</span>
                                    <ArrowUpDown
                                      size={12}
                                      className="ml-1 md:ml-2 text-gray-500 md:w-5 md:h-5"
                                    />
                                  </div>
                                </th>
                              )}
                              <th className="px-2 py-3 md:px-6 md:py-6 text-left text-xs md:text-lg font-bold text-gray-300 uppercase tracking-wider rounded-tr-xl w-24">
                                {leaderboardTab === "ranked"
                                  ? "Tier"
                                  : "To Rank"}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-gray-900 divide-y divide-gray-800">
                            {(leaderboardTab === "ranked"
                              ? rankedPlayers
                              : sortedUnrankedPlayers
                            ).map((player, index, currentPlayers) => {
                              const isLast =
                                index === currentPlayers.length - 1;
                              return (
                                <tr
                                  key={player.id}
                                  className="hover:bg-gray-800 transition-colors duration-150"
                                >
                                  <td
                                    className={`px-2 py-3 md:px-6 md:py-8 whitespace-nowrap ${
                                      isLast ? "rounded-bl-xl" : ""
                                    }`}
                                  >
                                    <div className="flex items-center">
                                      {leaderboardTab === "ranked" ? (
                                        <>
                                          <span className="text-sm md:text-3xl font-bold text-white">
                                            #{index + 1}
                                          </span>
                                          {index === 0 && (
                                            <Trophy
                                              size={14}
                                              className="ml-1 md:ml-3 md:w-6 md:h-6 text-yellow-500"
                                              style={{
                                                filter:
                                                  "drop-shadow(0 0 5px rgba(255, 215, 0, 0.5))",
                                              }}
                                            />
                                          )}
                                        </>
                                      ) : (
                                        <div className="flex items-center">
                                          <div
                                            className={`w-4 h-4 md:w-6 md:h-6 rounded-full mr-2 ${
                                              player.top_10_players_played >= 2
                                                ? "bg-green-500"
                                                : player.top_10_players_played >=
                                                  1
                                                ? "bg-yellow-500"
                                                : "bg-red-500"
                                            }`}
                                          ></div>
                                          <span className="text-sm md:text-lg font-bold text-gray-300">
                                            {player.top_10_players_played}/3
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-1 py-3 md:px-2 md:py-8 whitespace-nowrap text-center">
                                    {player.country &&
                                    isValidCountryCode(player.country) ? (
                                      <ReactCountryFlag
                                        countryCode={player.country.toUpperCase()}
                                        svg
                                        style={{
                                          width: "3rem",
                                          height: "2rem",
                                        }}
                                        className="inline-block"
                                      />
                                    ) : (
                                      <span className="text-gray-500 text-xs">
                                        -
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-2 py-3 md:px-6 md:py-8 whitespace-nowrap text-sm md:text-2xl font-bold text-white">
                                    <div
                                      className="flex items-center space-x-2 md:space-x-4 cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() =>
                                        handlePlayerClick(player.id)
                                      }
                                    >
                                      <ProfilePicture
                                        player={player}
                                        size="md"
                                      />
                                      <div className="flex items-center">
                                        <span>
                                          {player.display_name || player.name}
                                        </span>
                                        <FireStreak
                                          streak={
                                            player.current_win_streak || 0
                                          }
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  {leaderboardTab === "ranked" && (
                                    <td className="px-2 py-3 md:px-6 md:py-8 whitespace-nowrap">
                                      <span
                                        className="text-sm md:text-2xl font-bold text-yellow-500 bg-gray-800 px-2 py-1 md:px-4 md:py-2 rounded-full"
                                        style={{
                                          textShadow:
                                            "0 0 10px rgba(255, 215, 0, 0.6)",
                                        }}
                                      >
                                        {player.elo}
                                      </span>
                                    </td>
                                  )}
                                  <td
                                    className={`px-2 py-3 md:px-6 md:py-8 whitespace-nowrap ${
                                      isLast ? "rounded-br-xl" : ""
                                    }`}
                                  >
                                    {leaderboardTab === "ranked" ? (
                                      <span
                                        className={`px-2 py-1 md:px-4 md:py-2 inline-flex text-xs md:text-lg font-bold rounded-full ${getTierBadgeColor(
                                          getTier(player.elo, tierThresholds)
                                        )} shadow-lg`}
                                      >
                                        {getTier(player.elo, tierThresholds)}
                                      </span>
                                    ) : (
                                      <div className="text-center">
                                        <span className="text-sm md:text-lg font-bold text-gray-300">
                                          {3 - player.top_10_players_played}
                                        </span>
                                        <div className="text-xs text-gray-500">
                                          more needed
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Character Selection Grid (Tier List) */}
              {activeTab === "tiers" && (
                <div>
                  {sortedPlayers.length === 0 ? (
                    <div className="text-gray-400 text-center py-16 bg-gray-900 bg-opacity-50 rounded-2xl">
                      <p className="text-2xl font-bold">
                        No fighters have entered the arena yet!
                      </p>
                      <p className="mt-2 text-lg">
                        Add some fighters to begin the tournament
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl border border-gray-700 shadow-lg relative">
                      {/* Loading overlay when refreshing */}
                      {refreshing && (
                        <div className="absolute inset-0 bg-black bg-opacity-20 z-10 flex items-center justify-center backdrop-blur-sm rounded-2xl">
                          <div className="bg-gray-800 bg-opacity-90 px-6 py-3 rounded-full flex items-center space-x-3 border border-gray-600">
                            <div className="animate-spin h-5 w-5 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                            <span className="text-white font-medium">
                              Updating tier list...
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-center relative overflow-hidden rounded-t-2xl">
                        {/* Glare effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>

                        <div className="text-center relative z-10">
                          <h2
                            className="text-2xl font-bold text-white uppercase tracking-wider"
                            style={{
                              textShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
                            }}
                          >
                            Official Tier List
                          </h2>
                          <RefreshStatus
                            refreshing={refreshing}
                            countdown={countdown}
                            lastUpdated={lastUpdated}
                            centered={true}
                          />
                        </div>
                      </div>

                      <div
                        className={`p-6 transition-opacity duration-300 ${
                          refreshing ? "opacity-75" : "opacity-100"
                        }`}
                      >
                        {/* Tier List Table */}
                        <div className="space-y-1 md:space-y-0">
                          {(["S", "A", "B", "C", "D", "E"] as Tier[]).map(
                            (tierName) => {
                              const tierPlayers = tierList[tierName];

                              return (
                                <div
                                  key={tierName}
                                  className="flex bg-gray-800 rounded-lg md:rounded-none border border-gray-700 md:border-b md:border-l-0 md:border-r-0 md:border-t-0 relative"
                                >
                                  {/* Tier Label */}
                                  <div
                                    className={`${getTierBadgeColor(
                                      tierName
                                    )} w-20 md:w-32 flex items-center justify-center py-4 md:py-8`}
                                  >
                                    <span
                                      className="text-3xl md:text-5xl font-bold text-white"
                                      style={{
                                        textShadow:
                                          "2px 2px 4px rgba(0, 0, 0, 0.8)",
                                      }}
                                    >
                                      {tierName}
                                    </span>
                                  </div>

                                  {/* Players in Tier */}
                                  <div className="flex-1 p-4 md:p-8 relative">
                                    {tierPlayers.length === 0 ? (
                                      <div className="flex items-center justify-center h-16 md:h-24 text-gray-500 italic md:text-xl">
                                        No players in this tier
                                      </div>
                                    ) : (
                                      <div className="flex flex-wrap gap-4 md:gap-6">
                                        {tierPlayers.map((player) => (
                                          <div
                                            key={player.id}
                                            className="relative group cursor-pointer"
                                            title={`${
                                              player.display_name || player.name
                                            } - ELO: ${player.elo}`}
                                            onClick={() =>
                                              handlePlayerClick(player.id)
                                            }
                                          >
                                            <ProfilePicture
                                              player={player}
                                              size="lg"
                                              borderColor="border-gray-600 group-hover:border-yellow-400"
                                              borderWidth="border-2 md:border-3"
                                              additionalClasses="rounded-lg transition-all duration-200 bg-gray-700 md:shadow-lg"
                                            />

                                            {/* Player name and ELO tooltip on hover */}
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black bg-opacity-95 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[9999] shadow-xl border border-gray-600">
                                              <div className="font-semibold flex items-center">
                                                {player.display_name ||
                                                  player.name}
                                                {player.country &&
                                                  isValidCountryCode(
                                                    player.country
                                                  ) && (
                                                    <ReactCountryFlag
                                                      countryCode={player.country.toUpperCase()}
                                                      svg
                                                      style={{
                                                        width: "1rem",
                                                        height: "0.75rem",
                                                        marginLeft: "0.5rem",
                                                      }}
                                                    />
                                                  )}
                                                <FireStreak
                                                  streak={
                                                    player.current_win_streak ||
                                                    0
                                                  }
                                                />
                                              </div>
                                              <div className="text-yellow-400 font-bold">
                                                ELO: {player.elo}
                                              </div>
                                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Matches Tab */}
              {activeTab === "matches" && (
                <div>
                  {matches.length === 0 && !showFilters ? (
                    <div className="text-gray-400 text-center py-16 bg-gray-900 bg-opacity-50 rounded-2xl">
                      <p className="text-2xl font-bold">
                        No battles have been fought yet!
                      </p>
                      <p className="mt-2 text-lg">
                        Start playing some matches to see the battle history
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl border border-gray-700 shadow-lg relative">
                      {/* Loading overlay when refreshing */}
                      {refreshing && (
                        <div className="absolute inset-0 bg-black bg-opacity-20 z-10 flex items-center justify-center backdrop-blur-sm rounded-2xl">
                          <div className="bg-gray-800 bg-opacity-90 px-6 py-3 rounded-full flex items-center space-x-3 border border-gray-600">
                            <div className="animate-spin h-5 w-5 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                            <span className="text-white font-medium">
                              Updating match history...
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between relative overflow-hidden rounded-t-2xl">
                        {/* Glare effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>

                        <div className="flex flex-col md:flex-row items-center relative z-10 justify-between w-full">
                          <div className="flex items-center space-x-2">
                            <Swords
                              className="mr-3 text-yellow-500"
                              size={24}
                              style={{
                                filter:
                                  "drop-shadow(0 0 5px rgba(255, 215, 0, 0.5))",
                              }}
                            />
                            <div>
                              <h2
                                className="text-2xl font-bold text-white"
                                style={{
                                  textShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
                                }}
                              >
                                Match History
                              </h2>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`p-2 rounded-lg transition-colors duration-200 ${
                                  showFilters
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
                                }`}
                                title="Toggle Filters"
                              >
                                <Filter size={20} />
                              </button>
                            </div>
                          </div>
                          <RefreshStatus
                            refreshing={refreshing}
                            countdown={countdown}
                            lastUpdated={lastUpdated}
                            centered={false}
                            autoRefreshDisabled={autoRefreshDisabled}
                          />
                        </div>
                      </div>

                      <div
                        className={`p-6 transition-opacity duration-300 ${
                          refreshing ? "opacity-75" : "opacity-100"
                        }`}
                      >
                        {/* Filter Section */}
                        {showFilters && (
                          <>
                            <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
                              <h3 className="text-lg font-semibold text-white mb-4">
                                Filter Matches
                              </h3>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
                                {/* Player Filter */}
                                <div>
                                  <MultiSelect
                                    options={players.map((player) => ({
                                      value: player.name,
                                      label: player.display_name || player.name,
                                    }))}
                                    selected={selectedPlayerFilter}
                                    onChange={setSelectedPlayerFilter}
                                    placeholder="Select players..."
                                    label="Players"
                                  />
                                </div>

                                {/* Character Filter */}
                                <div>
                                  <MultiSelect
                                    options={Array.from(
                                      new Set(
                                        matches.flatMap((match) =>
                                          match.participants.map(
                                            (p) => p.smash_character
                                          )
                                        )
                                      )
                                    )
                                      .sort()
                                      .map((character) => ({
                                        value: character,
                                        label: character,
                                      }))}
                                    selected={selectedCharacterFilter}
                                    onChange={setSelectedCharacterFilter}
                                    placeholder="Select characters..."
                                    label="Characters"
                                  />
                                </div>
                              </div>

                              {/* Additional Filters */}
                              <div className="lg:col-span-2 space-y-4">
                                {/* Ranked Filter */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-300 mb-3">
                                    Player Ranking Status
                                  </label>
                                  <select
                                    value={rankedFilter}
                                    onChange={(e) =>
                                      setRankedFilter(e.target.value)
                                    }
                                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="all">All Players</option>
                                    <option value="ranked">
                                      Ranked Players Only
                                    </option>
                                    <option value="unranked">
                                      Unranked Players Only
                                    </option>
                                  </select>
                                </div>

                                {/* 1v1 Filter */}
                                <label className="flex items-center space-x-2 p-3 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer hover:bg-gray-600">
                                  <input
                                    type="checkbox"
                                    checked={only1v1}
                                    onChange={(e) =>
                                      setOnly1v1(e.target.checked)
                                    }
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className="text-white font-medium">
                                    Show only 1v1 matches (2 players)
                                  </span>
                                </label>
                              </div>

                              {/* Search and Clear Buttons */}
                              <div className="flex justify-center gap-4 mt-6">
                                <button
                                  onClick={handleSearch}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200 flex items-center gap-2"
                                >
                                  <Swords size={16} />
                                  Search
                                </button>
                                <button
                                  onClick={async () => {
                                    setSelectedPlayerFilter([]);
                                    setSelectedCharacterFilter([]);
                                    setOnly1v1(false);
                                    setRankedFilter("all");
                                    setMatchesPage(1);
                                    updateMatchesURL([], [], false);
                                    await fetchMatches(1, false, [], [], false);
                                  }}
                                  className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
                                >
                                  Clear All
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                        {matches.length === 0 ? (
                          <div className="text-gray-400 text-center py-16">
                            <p className="text-xl font-bold">
                              No matches found with current filters
                            </p>
                            <p className="mt-2">
                              Try adjusting your filters or clear them to see
                              all matches
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-4">
                              {matches.map((match) => {
                                const participants = match.participants.sort(
                                  (a, b) => {
                                    if (a.has_won && !b.has_won) return -1;
                                    if (!a.has_won && b.has_won) return 1;
                                    return 0;
                                  }
                                );

                                return (
                                  <div
                                    key={match.id}
                                    className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                                  >
                                    <div className="flex flex-col space-y-4">
                                      {/* Match Header */}
                                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                                        <div className="text-gray-400 text-sm">
                                          <span className="font-medium text-gray-300">
                                            Match #{match.id}
                                          </span>
                                          {" • "}
                                          <button
                                            onClick={() =>
                                              setShowUtcTime(!showUtcTime)
                                            }
                                            className="hover:text-gray-200 transition-colors duration-200 underline-offset-2 hover:underline"
                                            title={
                                              showUtcTime
                                                ? "Click to show local time"
                                                : "Click to show UTC time"
                                            }
                                          >
                                            {showUtcTime
                                              ? new Date(
                                                  match.created_at
                                                ).toLocaleDateString("en-US", {
                                                  timeZone: "UTC",
                                                })
                                              : new Date(
                                                  match.created_at
                                                ).toLocaleDateString()}{" "}
                                            •{" "}
                                            {showUtcTime
                                              ? new Date(
                                                  match.created_at
                                                ).toLocaleTimeString("en-US", {
                                                  timeZone: "UTC",
                                                }) + " UTC"
                                              : new Date(
                                                  match.created_at
                                                ).toLocaleTimeString()}
                                          </button>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <div className="text-gray-500 font-medium">
                                            {participants.length} Player
                                            {participants.length > 1 ? "s" : ""}
                                          </div>
                                          {(() => {
                                            const playerNames =
                                              participants.map(
                                                (p) => p.player_name
                                              );
                                            const isExactMatch =
                                              selectedPlayerFilter.length ===
                                                playerNames.length &&
                                              playerNames.every((name) =>
                                                selectedPlayerFilter.includes(
                                                  name
                                                )
                                              ) &&
                                              selectedPlayerFilter.every(
                                                (name) =>
                                                  playerNames.includes(name)
                                              );

                                            if (isExactMatch) return null;

                                            return (
                                              <button
                                                onClick={() => {
                                                  const is1v1 =
                                                    playerNames.length === 2;
                                                  setSelectedPlayerFilter(
                                                    playerNames
                                                  );
                                                  setSelectedCharacterFilter(
                                                    []
                                                  );
                                                  setOnly1v1(is1v1);
                                                  setShowFilters(true);
                                                  setTimeout(async () => {
                                                    setMatchesPage(1);
                                                    updateMatchesURL(
                                                      playerNames,
                                                      [],
                                                      is1v1
                                                    );
                                                    await fetchMatches(
                                                      1,
                                                      false,
                                                      playerNames,
                                                      [],
                                                      is1v1
                                                    );
                                                  }, 100);
                                                }}
                                                className="text-xs bg-gray-600 hover:bg-gray-500 text-white font-medium py-1 px-2 rounded transition-colors duration-200"
                                              >
                                                Filter for this matchup
                                              </button>
                                            );
                                          })()}

                                          {/* Refresh Button */}
                                          <button
                                            onClick={() =>
                                              refreshSingleMatch(match.id)
                                            }
                                            disabled={refreshingMatches.has(
                                              match.id
                                            )}
                                            className="flex items-center gap-1 text-xs bg-gray-600 hover:bg-gray-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-medium py-1 px-2 rounded transition-colors duration-200"
                                            title="Refresh this match"
                                          >
                                            {refreshingMatches.has(match.id) ? (
                                              <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full"></div>
                                            ) : (
                                              <svg
                                                className="w-3 h-3"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                                />
                                              </svg>
                                            )}
                                          </button>
                                        </div>
                                      </div>

                                      {/* All Participants */}
                                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:justify-between">
                                        {participants.map((participant) => (
                                          <div
                                            key={participant.id}
                                            className={`flex flex-col space-y-3 px-4 py-3 rounded-lg border transition-all w-full ${
                                              participants.length === 1
                                                ? "sm:w-80"
                                                : participants.length === 2
                                                ? "sm:flex-1 sm:max-w-md"
                                                : participants.length === 3
                                                ? "sm:w-72"
                                                : participants.length === 4
                                                ? "sm:w-52"
                                                : "sm:w-44"
                                            } ${
                                              participant.has_won
                                                ? "bg-green-900 bg-opacity-30 border-green-500 shadow-green-500/20 shadow-lg"
                                                : "bg-red-900 bg-opacity-20 border-red-600"
                                            }`}
                                          >
                                            {/* Player Header */}
                                            <div className="flex items-center space-x-3">
                                              {/* Player Avatar */}
                                              <ProfilePicture
                                                player={{
                                                  name: participant.player_name,
                                                  display_name:
                                                    participant.player_display_name,
                                                }}
                                                size="sm"
                                                borderColor={
                                                  participant.has_won
                                                    ? "border-green-400"
                                                    : "border-red-400"
                                                }
                                                additionalClasses={
                                                  participant.has_won
                                                    ? "bg-green-600"
                                                    : "bg-red-600"
                                                }
                                              />

                                              {/* Player Info */}
                                              <div className="flex-1 min-w-0">
                                                <div
                                                  className="text-white font-semibold truncate cursor-pointer hover:text-yellow-400 transition-colors"
                                                  onClick={() =>
                                                    handlePlayerClick(
                                                      participant.player
                                                    )
                                                  }
                                                >
                                                  {participant.player_display_name ||
                                                    participant.player_name}
                                                </div>
                                                <div
                                                  className={`text-sm font-medium ${
                                                    participant.has_won
                                                      ? "text-green-400"
                                                      : "text-red-400"
                                                  }`}
                                                >
                                                  {participant.smash_character}
                                                </div>
                                              </div>

                                              {/* Win/Loss Indicator */}
                                              <div className="w-10 h-10 flex items-center justify-center">
                                                <img
                                                  src={
                                                    participant.has_won
                                                      ? "/images/no1.png"
                                                      : "/images/no2.png"
                                                  }
                                                  alt={
                                                    participant.has_won
                                                      ? "Winner"
                                                      : "Loser"
                                                  }
                                                  className="w-8 h-8 object-contain"
                                                />
                                              </div>
                                            </div>

                                            {/* Individual Player Stats */}
                                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                              <div className="bg-black bg-opacity-20 rounded px-2 py-1">
                                                <div className="text-orange-400 font-bold text-lg">
                                                  {participant.total_kos || 0}
                                                </div>
                                                <div className="text-gray-400">
                                                  KOs
                                                </div>
                                              </div>
                                              <div className="bg-black bg-opacity-20 rounded px-2 py-1">
                                                <div className="text-purple-400 font-bold text-lg">
                                                  {participant.total_falls || 0}
                                                </div>
                                                <div className="text-gray-400">
                                                  Falls
                                                </div>
                                              </div>
                                              <div className="bg-black bg-opacity-20 rounded px-2 py-1">
                                                <div className="text-red-400 font-bold text-lg">
                                                  {participant.total_sds || 0}
                                                </div>
                                                <div className="text-gray-400">
                                                  SDs
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Load More Button */}
                            {hasMoreMatches && (
                              <div className="flex justify-center mt-6">
                                <button
                                  onClick={loadMoreMatches}
                                  disabled={loadingMoreMatches}
                                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-lg"
                                >
                                  {loadingMoreMatches ? (
                                    <>
                                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                      <span>Loading more matches...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Swords size={20} />
                                      <span>Load More Matches</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Players Tab */}
              {activeTab === "players" && (
                <div>
                  {sortedPlayers.length === 0 ? (
                    <div className="text-gray-400 text-center py-16 bg-gray-900 bg-opacity-50 rounded-2xl">
                      <p className="text-2xl font-bold">
                        No fighters have joined the roster yet!
                      </p>
                      <p className="mt-2 text-lg">
                        Add some players to see their detailed profiles
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl border border-gray-700 shadow-lg relative">
                      {/* Loading overlay when refreshing */}
                      {refreshing && (
                        <div className="absolute inset-0 bg-black bg-opacity-20 z-10 flex items-center justify-center backdrop-blur-sm rounded-2xl">
                          <div className="bg-gray-800 bg-opacity-90 px-6 py-3 rounded-full flex items-center space-x-3 border border-gray-600">
                            <div className="animate-spin h-5 w-5 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                            <span className="text-white font-medium">
                              Updating player profiles...
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between relative overflow-hidden rounded-t-2xl">
                        {/* Glare effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>

                        <div className="flex flex-col md:flex-row items-center relative z-10 justify-between w-full">
                          <div className="flex items-center space-x-2">
                            <Users
                              className="mr-3 text-yellow-500"
                              size={24}
                              style={{
                                filter:
                                  "drop-shadow(0 0 5px rgba(255, 215, 0, 0.5))",
                              }}
                            />
                            <div>
                              <h2
                                className="text-2xl font-bold text-white"
                                style={{
                                  textShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
                                }}
                              >
                                Fighter Profiles
                              </h2>
                            </div>
                          </div>
                          <RefreshStatus
                            refreshing={refreshing}
                            countdown={countdown}
                            lastUpdated={lastUpdated}
                            centered={false}
                          />
                        </div>
                      </div>

                      <div
                        className={`p-6 transition-opacity duration-300 ${
                          refreshing ? "opacity-75" : "opacity-100"
                        }`}
                      >
                        {/* Ranked Players Section */}
                        {rankedPlayers.length > 0 && (
                          <div className="mb-8">
                            <h3 className="text-xl font-bold text-white mb-4 px-2">
                              Ranked Players ({rankedPlayers.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {rankedPlayers.map((player, index) => {
                                const winRate =
                                  player.total_wins &&
                                  player.total_wins +
                                    (player.total_losses || 0) >
                                    0
                                    ? (
                                        (player.total_wins /
                                          (player.total_wins +
                                            (player.total_losses || 0))) *
                                        100
                                      ).toFixed(1)
                                    : "0.0";

                                return (
                                  <div
                                    key={player.id}
                                    id={`player-${player.id}`}
                                    className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all duration-300 hover:transform hover:scale-105 shadow-lg relative overflow-hidden"
                                  >
                                    {/* Rank badge */}
                                    <div className="absolute top-4 right-4">
                                      <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                                        #{index + 1}
                                      </div>
                                    </div>

                                    {/* Player Avatar and Info */}
                                    <div className="flex flex-col items-center mb-6">
                                      <div className="relative mb-4">
                                        <ProfilePicture
                                          player={player}
                                          size="xl"
                                          borderWidth="border-4"
                                          additionalClasses="shadow-xl bg-gradient-to-br from-gray-600 to-gray-700"
                                        />
                                      </div>

                                      <div className="flex items-center justify-center mb-1">
                                        <h3 className="text-xl font-bold text-white text-center">
                                          {player.display_name || player.name}
                                        </h3>
                                        {player.country &&
                                          isValidCountryCode(
                                            player.country
                                          ) && (
                                            <ReactCountryFlag
                                              countryCode={player.country.toUpperCase()}
                                              svg
                                              style={{
                                                width: "2rem",
                                                height: "1.5rem",
                                                marginLeft: "0.5rem",
                                              }}
                                            />
                                          )}
                                        <FireStreak
                                          streak={
                                            player.current_win_streak || 0
                                          }
                                        />
                                      </div>

                                      {/* ELO Display - only for ranked players */}
                                      {player.is_ranked && (
                                        <div className="bg-gray-700 px-4 py-2 rounded-full mb-2">
                                          <span className="text-yellow-500 font-bold text-lg">
                                            {player.elo} ELO
                                          </span>
                                        </div>
                                      )}

                                      {/* Main Character */}
                                      {player.main_character && (
                                        <div className="bg-blue-900 bg-opacity-50 px-3 py-1 rounded-full border border-blue-500">
                                          <span className="text-blue-300 text-sm font-medium">
                                            Main: {player.main_character}
                                          </span>
                                        </div>
                                      )}

                                      {/* Ranking Status */}
                                      <div
                                        className={`px-3 py-1 rounded-full border mt-2 ${
                                          player.is_ranked
                                            ? "bg-green-900 bg-opacity-50 border-green-500"
                                            : "bg-orange-900 bg-opacity-50 border-orange-500"
                                        }`}
                                      >
                                        <span
                                          className={`text-sm font-medium ${
                                            player.is_ranked
                                              ? "text-green-300"
                                              : "text-orange-300"
                                          }`}
                                        >
                                          {player.is_ranked
                                            ? "Ranked Player"
                                            : `${player.top_10_players_played}/3 vs Top 10`}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Stats Section */}
                                    <div className="space-y-4">
                                      {/* Win/Loss Record */}
                                      <div className="bg-gray-700 bg-opacity-50 rounded-lg p-4">
                                        <h4 className="text-gray-300 text-sm font-semibold mb-3 uppercase tracking-wide">
                                          Match Record
                                        </h4>
                                        <div className="flex justify-between items-center mb-2">
                                          <div className="flex items-center space-x-2">
                                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                            <span className="text-green-400 font-bold">
                                              Wins
                                            </span>
                                          </div>
                                          <span className="text-white font-bold text-lg">
                                            {player.total_wins || 0}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center mb-3">
                                          <div className="flex items-center space-x-2">
                                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                            <span className="text-red-400 font-bold">
                                              Losses
                                            </span>
                                          </div>
                                          <span className="text-white font-bold text-lg">
                                            {player.total_losses || 0}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-400 font-medium">
                                            Win Rate
                                          </span>
                                          <span className="text-yellow-400 font-bold">
                                            {winRate}%
                                          </span>
                                        </div>
                                      </div>

                                      {/* Combat Stats */}
                                      <div className="bg-gray-700 bg-opacity-50 rounded-lg p-4">
                                        <h4 className="text-gray-300 text-sm font-semibold mb-3 uppercase tracking-wide">
                                          Combat Stats
                                        </h4>
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                          <div>
                                            <div className="text-orange-400 font-bold text-lg">
                                              {player.total_kos || 0}
                                            </div>
                                            <div className="text-gray-400 text-xs uppercase">
                                              KOs
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-purple-400 font-bold text-lg">
                                              {player.total_falls || 0}
                                            </div>
                                            <div className="text-gray-400 text-xs uppercase">
                                              Falls
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-red-400 font-bold text-lg">
                                              {player.total_sds || 0}
                                            </div>
                                            <div className="text-gray-400 text-xs uppercase">
                                              SDs
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Additional Stats */}
                                      <div className="grid grid-cols-2 gap-2 text-center">
                                        <div className="bg-gray-700 bg-opacity-30 rounded-lg p-2">
                                          <div className="text-blue-400 font-bold">
                                            {player.matches}
                                          </div>
                                          <div className="text-gray-400 text-xs">
                                            Matches
                                          </div>
                                        </div>
                                        <div className="bg-gray-700 bg-opacity-30 rounded-lg p-2">
                                          <div className="text-cyan-400 font-bold">
                                            {(player.total_kos || 0) > 0 &&
                                            (player.total_falls || 0) +
                                              (player.total_sds || 0) >
                                              0
                                              ? (
                                                  (player.total_kos || 0) /
                                                  ((player.total_falls || 0) +
                                                    (player.total_sds || 0))
                                                ).toFixed(2)
                                              : "0.00"}
                                          </div>
                                          <div className="text-gray-400 text-xs">
                                            K/D Ratio
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* View Match History Button */}
                                    <div className="mt-4 pt-4 border-t border-gray-600">
                                      <button
                                        onClick={() => {
                                          setSelectedPlayerFilter([
                                            player.name,
                                          ]);
                                          setSelectedCharacterFilter([]);
                                          setShowFilters(true);
                                          const params = new URLSearchParams();
                                          params.append("player", player.name);
                                          router.push(
                                            `/matches?${params.toString()}`
                                          );
                                        }}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                                      >
                                        View Match History
                                      </button>
                                    </div>

                                    {/* Decorative elements */}
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50"></div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Unranked Players Section */}
                        {sortedUnrankedPlayers.length > 0 && (
                          <div>
                            <h3 className="text-xl font-bold text-white mb-4 px-2">
                              Unranked Players ({sortedUnrankedPlayers.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {sortedUnrankedPlayers.map((player) => {
                                const winRate =
                                  player.total_wins &&
                                  player.total_wins +
                                    (player.total_losses || 0) >
                                    0
                                    ? (
                                        (player.total_wins /
                                          (player.total_wins +
                                            (player.total_losses || 0))) *
                                        100
                                      ).toFixed(1)
                                    : "0.0";

                                return (
                                  <div
                                    key={player.id}
                                    id={`player-${player.id}`}
                                    className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all duration-300 hover:transform hover:scale-105 shadow-lg relative overflow-hidden"
                                  >
                                    {/* No rank badge for unranked players */}

                                    {/* Player Avatar and Info */}
                                    <div className="flex flex-col items-center mb-6">
                                      <div className="relative mb-4">
                                        <ProfilePicture
                                          player={player}
                                          size="xl"
                                          borderWidth="border-4"
                                          additionalClasses="shadow-xl bg-gradient-to-br from-gray-600 to-gray-700"
                                        />
                                      </div>

                                      <div className="flex items-center justify-center mb-1">
                                        <h3 className="text-xl font-bold text-white text-center">
                                          {player.display_name || player.name}
                                        </h3>
                                        {player.country &&
                                          isValidCountryCode(
                                            player.country
                                          ) && (
                                            <ReactCountryFlag
                                              countryCode={player.country.toUpperCase()}
                                              svg
                                              style={{
                                                width: "2rem",
                                                height: "1.5rem",
                                                marginLeft: "0.5rem",
                                              }}
                                            />
                                          )}
                                        <FireStreak
                                          streak={
                                            player.current_win_streak || 0
                                          }
                                        />
                                      </div>

                                      {/* No ELO for unranked players */}

                                      {/* Main Character */}
                                      {player.main_character && (
                                        <div className="bg-blue-900 bg-opacity-50 px-3 py-1 rounded-full border border-blue-500">
                                          <span className="text-blue-300 text-sm font-medium">
                                            Main: {player.main_character}
                                          </span>
                                        </div>
                                      )}

                                      {/* Ranking Status */}
                                      <div className="bg-orange-900 bg-opacity-50 px-3 py-1 rounded-full border border-orange-500 mt-2">
                                        <span className="text-orange-300 text-sm font-medium">
                                          {player.top_10_players_played}/3 vs
                                          Top 10
                                        </span>
                                      </div>
                                    </div>

                                    {/* Stats Section */}
                                    <div className="space-y-4">
                                      {/* Win/Loss Record */}
                                      <div className="bg-gray-700 bg-opacity-50 rounded-lg p-4">
                                        <h4 className="text-gray-300 text-sm font-semibold mb-3 uppercase tracking-wide">
                                          Match Record
                                        </h4>
                                        <div className="flex justify-between items-center mb-2">
                                          <div className="flex items-center space-x-2">
                                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                            <span className="text-green-400 font-bold">
                                              Wins
                                            </span>
                                          </div>
                                          <span className="text-white font-bold text-lg">
                                            {player.total_wins || 0}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center mb-3">
                                          <div className="flex items-center space-x-2">
                                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                            <span className="text-red-400 font-bold">
                                              Losses
                                            </span>
                                          </div>
                                          <span className="text-white font-bold text-lg">
                                            {player.total_losses || 0}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-400 font-medium">
                                            Win Rate
                                          </span>
                                          <span className="text-yellow-400 font-bold">
                                            {winRate}%
                                          </span>
                                        </div>
                                      </div>

                                      {/* Combat Stats */}
                                      <div className="bg-gray-700 bg-opacity-50 rounded-lg p-4">
                                        <h4 className="text-gray-300 text-sm font-semibold mb-3 uppercase tracking-wide">
                                          Combat Stats
                                        </h4>
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                          <div>
                                            <div className="text-orange-400 font-bold text-lg">
                                              {player.total_kos || 0}
                                            </div>
                                            <div className="text-gray-400 text-xs uppercase">
                                              KOs
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-purple-400 font-bold text-lg">
                                              {player.total_falls || 0}
                                            </div>
                                            <div className="text-gray-400 text-xs uppercase">
                                              Falls
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-red-400 font-bold text-lg">
                                              {player.total_sds || 0}
                                            </div>
                                            <div className="text-gray-400 text-xs uppercase">
                                              SDs
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Additional Stats */}
                                      <div className="grid grid-cols-2 gap-2 text-center">
                                        <div className="bg-gray-700 bg-opacity-30 rounded-lg p-2">
                                          <div className="text-blue-400 font-bold">
                                            {player.matches}
                                          </div>
                                          <div className="text-gray-400 text-xs">
                                            Matches
                                          </div>
                                        </div>
                                        <div className="bg-gray-700 bg-opacity-30 rounded-lg p-2">
                                          <div className="text-cyan-400 font-bold">
                                            {(player.total_kos || 0) > 0 &&
                                            (player.total_falls || 0) +
                                              (player.total_sds || 0) >
                                              0
                                              ? (
                                                  (player.total_kos || 0) /
                                                  ((player.total_falls || 0) +
                                                    (player.total_sds || 0))
                                                ).toFixed(2)
                                              : "0.00"}
                                          </div>
                                          <div className="text-gray-400 text-xs">
                                            K/D Ratio
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* View Match History Button */}
                                    <div className="mt-4 pt-4 border-t border-gray-600">
                                      <button
                                        onClick={() => {
                                          setSelectedPlayerFilter([
                                            player.name,
                                          ]);
                                          setSelectedCharacterFilter([]);
                                          setShowFilters(true);
                                          const params = new URLSearchParams();
                                          params.append("player", player.name);
                                          router.push(
                                            `/matches?${params.toString()}`
                                          );
                                        }}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                                      >
                                        View Match History
                                      </button>
                                    </div>

                                    {/* Decorative elements */}
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50"></div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-12 mb-6 text-center">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl px-6 py-4 border border-gray-700 shadow-lg max-w-md mx-auto">
            <p className="text-gray-300 text-sm">
              Made with{" "}
              <span className="text-red-500 animate-pulse text-lg">❤️</span> by{" "}
              <a
                href="https://twitter.com/haseab_"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-semibold transition-colors duration-200 hover:underline"
              >
                haseab
              </a>
              ,{" "}
              <a
                href="https://twitter.com/subby_tech"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-semibold transition-colors duration-200 hover:underline"
              >
                subby
              </a>
              , and{" "}
              <a
                href="https://twitter.com/thiteanish"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-semibold transition-colors duration-200 hover:underline"
              >
                anish
              </a>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
