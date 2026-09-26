import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pudwnwcixqheuhzfalpx.supabase.co';
const supabaseKey = 'sb_publishable_EmfMKWSpkTdqN7EaNGS-Aw_ovyJyqDC';

export const supabase = createClient(supabaseUrl, supabaseKey); 