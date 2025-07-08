import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// For server-side operations, use service role key
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Type definition for player
export interface Player {
  id: number;
  created_at: string;
  name: string;
  display_name: string | null;
  elo: number;
  main_character?: string | null;
  total_wins?: number;
  total_losses?: number;
  current_win_streak?: number;
}
