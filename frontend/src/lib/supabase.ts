import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhzkjlfmiycpzczujzzu.supabase.co';
const supabaseAnonKey = 'sb_publishable_UT66j0qs7YLBQL7LSxjhZQ_Uok2gg-B';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
