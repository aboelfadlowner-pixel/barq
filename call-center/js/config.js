/* =====================================================================
 *  Where the app reads and writes data.
 *
 *  DATA_MODE
 *    'supabase' → the call-center tables (cc_*) in Supabase — on the GitHub
 *                 Pages link (aboelfadlowner-pixel.github.io/barq/call-center/).
 *    'mock'     → built-in demo data anywhere else (local preview, demo link).
 *                 Nothing leaves the browser.
 *
 *  Only the project URL and the PUBLIC anon (publishable) key go here.
 *  Never put the service_role key, the database password or any user
 *  password in this file or anywhere in the code.
 * ===================================================================== */
export const DATA_MODE = location.hostname === 'aboelfadlowner-pixel.github.io' ? 'supabase' : 'mock';

/* Same project and the same PUBLIC anon key the other Abu El Fadl tools use. */
export const SUPABASE_URL = 'https://ojvbydnvywbsgyhqftap.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdmJ5ZG52eXdic2d5aHFmdGFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzODQyMDcsImV4cCI6MjA5Njk2MDIwN30.3UyyKGcmehGVxadPotOgwYF6CmDbkdb8gw7BFxlYFcU';

/* The one shared call-center account (Supabase Auth email). When set, the
   login screen asks for the password only. */
export const ACCOUNT_EMAIL = '';

/* One-time helper: shows "إنشاء الأكونت لأول مرة" on the sign-in screen so the
   call-center account can be created without the Supabase dashboard. A new
   account sees nothing until it is linked in cc_staff. Turn back to false once
   the call-center account exists. */
export const ALLOW_SIGNUP = true;
