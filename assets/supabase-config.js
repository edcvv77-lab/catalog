// supabase-config.js
// تهيئة الاتصال بـ Supabase

const SUPABASE_URL = "https://quxfuxunneaulnaaytnb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BOdkH2OY_N7CJIn1fFTYVQ_bxH42P-Y";

(function () {
  const supabaseLibrary = window.supabase;

  if (!supabaseLibrary || typeof supabaseLibrary.createClient !== "function") {
    console.error("Supabase library failed to load.");
    window.supabase = undefined;
    return;
  }

  const supabaseClient = supabaseLibrary.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  window.supabase = supabaseClient;
})();
