// ВСТАВЬ СЮДА СВОИ КЛЮЧИ ИЗ SUPABASE
const SUPABASE_URL = 'https://sbnpevmtgynnglynrngp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_secret_gUZ9MSB1vTczMFzqYVYfwA_6BWN-nCw';

// Инициализация Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);