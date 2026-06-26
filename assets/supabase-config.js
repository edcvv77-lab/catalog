// supabase-config.js
// تهيئة الاتصال بـ Supabase

// عدّل القيم أدناه لتطابق مشروعك في Supabase
const SUPABASE_URL = "https://quxfuxunneaulnaaytnb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BOdkH2OY_N7CJIn1fFTYVQ_bxH42P-Y";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// توفير العميل لاستخدامه عالمياً
window.supabase = supabaseClient;
