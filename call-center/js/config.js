/* =====================================================================
 *  Where the app reads and writes data.
 *
 *  DATA_MODE
 *    'mock'     → built-in demo data. Nothing leaves the browser. (default)
 *    'supabase' → the call-center tables (cc_*) in Supabase.
 *
 *  Only the project URL and the PUBLIC anon (publishable) key go here.
 *  Never put the service_role key, the database password or any user
 *  password in this file or anywhere in the code.
 * ===================================================================== */
export const DATA_MODE = 'mock';
export const SUPABASE_URL = '';        // e.g. https://<project-ref>.supabase.co
export const SUPABASE_ANON_KEY = '';   // public anon key only

/* The one shared call-center account (Supabase Auth email). When set, the
   login screen asks for the password only. */
export const ACCOUNT_EMAIL = '';

/* One-time helper: shows "إنشاء الأكونت لأول مرة" on the sign-in screen so the
   call-center account can be created without the Supabase dashboard. A new
   account sees nothing until it is linked in cc_staff. Keep false otherwise. */
export const ALLOW_SIGNUP = false;
