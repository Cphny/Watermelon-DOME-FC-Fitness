import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Every user auto-joins this one shared group for now.
// Created once via bootstrap-group.sql.
export const DEFAULT_GROUP_ID = "00000000-0000-0000-0000-000000000001";
