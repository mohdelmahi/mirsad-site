// Public settings for the Mirsad portal. The publishable key is safe to expose:
// row level security in the database decides what each signed-in user can see.
window.MIRSAD = {
  supabaseUrl: "https://aohpeggeddovoaxmpaew.supabase.co",
  supabaseKey: "sb_publishable_PPc8i3ElGd7mOAfx9WsxFA_F6X8CXU6",
  functionsUrl: "https://aohpeggeddovoaxmpaew.supabase.co/functions/v1",
  limits: { starter: { tracked: 5, searches: 50 }, professional: { tracked: Infinity, searches: Infinity } },
};
window.sb = supabase.createClient(MIRSAD.supabaseUrl, MIRSAD.supabaseKey);
