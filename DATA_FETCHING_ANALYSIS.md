# Data Fetching Analysis

## Summary

The refresh is slow because:

1. **Rankings/Tier List tabs**: Always fetch ALL player data with complex SQL queries that process ALL matches
2. **Matches tab**: Has a CRITICAL performance bug - loads ALL matches into memory before filtering
3. **On refresh**: Both queries run again, even if you're on rankings/tier list (which don't need match data)

---

## How Data is Fetched

### On First Load

#### Rankings Tab (`/`)
1. **`fetchPlayers()`** is called
   - Fetches from `/api/players`
   - Uses cache if available (< 30 seconds old)
   - If cache miss, runs complex SQL query

#### Tier List Tab (`/tierlist`)
1. **`fetchPlayers()`** is called (same as rankings)
   - Uses player data to calculate tiers

#### Matches Tab (`/matches`)
1. **`fetchPlayers()`** is called
2. **`fetchMatches()`** is called
   - Fetches page 1 (20 matches)
   - **BUT**: The API loads ALL matches first, then filters in memory (see performance issue below)

#### Players Tab (`/players`)
1. **`fetchPlayers()`** is called (same as rankings)

### On Refresh (Every 30 seconds)

#### Rankings/Tier List Tabs
- **`fetchPlayers(true)`** - Background refresh
  - Always runs the full SQL query (no cache check on refresh)
  - This query processes ALL matches in the database

#### Matches Tab
- **`fetchPlayers(true)`** - Background refresh
- **`fetchMatches(1, false, ...)`** - Refreshes matches
  - **CRITICAL BUG**: Loads ALL matches into memory before filtering

---

## Performance Issues

### Issue #1: `/api/matches` Loads ALL Matches

**Location**: `src/app/api/matches/route.ts` lines 26-41

**Problem**:
```typescript
// This loads ALL matches with ALL participants - NO pagination!
const allMatches = await prisma.matches.findMany({
  where: { archived: false },
  include: {
    match_participants: {
      include: { players: { select: { name: true } } }
    }
  }
});

// Then filters in JavaScript memory (lines 44-73)
const filteredMatches = allMatches.filter((match) => {
  // ... filtering logic
});
```

**Impact**: 
- If you have 1000 matches, it loads all 1000 matches + all participants into memory
- Then filters down to 20 matches
- This happens on EVERY refresh on the matches tab

**Fix Needed**: Move filtering to database level using Prisma queries

### Issue #2: `/api/players` Complex Query Runs on Every Refresh

**Location**: `src/app/api/players/route.ts` lines 28-136

**Problem**:
- Complex SQL query with multiple CTEs that processes ALL matches:
  - `one_v_one_matches` - Filters all matches
  - `main_chars` - Calculates character usage from all matches
  - `player_stats` - Aggregates stats from all matches
  - `win_streaks` - Calculates streaks from all matches
  - `last_match_dates` - Gets dates from all matches

**Impact**:
- Runs on every refresh (even on rankings/tier list tabs)
- Processes entire match history every time
- Gets slower as more matches are added

**Current Behavior**:
- Initial load: Uses cache if available (< 30 seconds)
- Refresh: Always runs full query (no cache check)

### Issue #3: Unnecessary Data Fetching

**Location**: `src/components/SmashTournamentELO.tsx` line 640

**Problem**:
- On refresh, `fetchPlayers(true)` is ALWAYS called
- Even on rankings/tier list tabs where match data isn't needed
- The players query processes all matches anyway

**Impact**:
- Rankings tab refresh unnecessarily processes all match data
- Tier list tab refresh unnecessarily processes all match data

---

## Query Details

### `/api/players` Query Breakdown

1. **`one_v_one_matches` CTE**: 
   - Scans all matches
   - Groups by match_id
   - Filters to matches with exactly 2 non-CPU participants
   - **Complexity**: O(n) where n = total matches

2. **`main_chars` CTE**:
   - Joins match_participants with filtered matches
   - Groups by player + character
   - Uses window function to rank characters
   - **Complexity**: O(m) where m = total match participants

3. **`player_stats` CTE**:
   - Aggregates wins, losses, KOs, Falls, SDs
   - Filters through all match participants
   - **Complexity**: O(m)

4. **`win_streaks` CTE**:
   - Orders matches by player
   - Calculates consecutive wins
   - Uses nested subqueries
   - **Complexity**: O(m * log m) worst case

5. **`last_match_dates` CTE**:
   - Gets max created_at per player
   - **Complexity**: O(m)

**Total Complexity**: Processes entire match history every time

### `/api/matches` Query Breakdown

**Current Implementation**:
1. Load ALL matches with participants (no limit)
2. Filter in JavaScript memory
3. Apply pagination after filtering

**Should Be**:
1. Build Prisma query with filters
2. Apply pagination at database level
3. Only fetch 20 matches + participants

---

## Recommendations

### High Priority Fixes

1. **Fix `/api/matches` to filter at database level**
   - Use Prisma `where` clauses instead of loading all matches
   - Apply pagination before fetching
   - This will dramatically improve matches tab performance

2. **Add caching to `/api/players` refresh**
   - Currently refresh always runs full query
   - Should check cache even on refresh
   - Or use incremental updates instead of full recalculation

3. **Skip `fetchPlayers()` refresh on matches tab**
   - Matches tab doesn't need fresh player data every 30 seconds
   - Only refresh matches, not players

### Medium Priority Optimizations

1. **Optimize `/api/players` query**
   - Consider materialized views for stats
   - Cache win streak calculations
   - Use database indexes effectively

2. **Add request deduplication**
   - If refresh is triggered while previous refresh is still running, skip it
   - Prevent multiple simultaneous queries

3. **Progressive loading**
   - Load basic player data first
   - Load stats in background
   - Show cached data while refreshing

---

## Current Refresh Flow

```
Every 30 seconds:
├── Rankings Tab
│   └── fetchPlayers(true) → Full SQL query (processes ALL matches)
│
├── Tier List Tab  
│   └── fetchPlayers(true) → Full SQL query (processes ALL matches)
│
└── Matches Tab
    ├── fetchPlayers(true) → Full SQL query (processes ALL matches)
    └── fetchMatches() → Loads ALL matches → Filters → Returns 20
```

---

## Expected Performance After Fixes

```
Every 30 seconds:
├── Rankings Tab
│   └── fetchPlayers(true) → Check cache → Skip if fresh OR optimized query
│
├── Tier List Tab  
│   └── fetchPlayers(true) → Check cache → Skip if fresh OR optimized query
│
└── Matches Tab
    └── fetchMatches() → Database-level filtering → Returns 20 matches only
```

---

## Testing Recommendations

1. Add query timing logs to measure actual performance
2. Test with large datasets (1000+ matches)
3. Monitor database query execution times
4. Check memory usage during refresh
5. Test concurrent refresh requests


