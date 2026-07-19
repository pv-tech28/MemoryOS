import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wzizsmdsyemhejupbacg.supabase.co';
const supabaseAnonKey = 'sb_publishable_2ZIEQZ5Oqi4_6YEDoVjfEg_ETtw6NKW';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
