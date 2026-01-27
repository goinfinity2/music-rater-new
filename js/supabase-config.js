// ВСТАВЬ СЮДА СВОИ КЛЮЧИ ИЗ SUPABASE
const SUPABASE_URL = 'https://sbnpevmtgynnglynrngp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PILiIHIeP-7kR4j6UWdmXA_2Zb5Z1UJ';

// Инициализация Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);