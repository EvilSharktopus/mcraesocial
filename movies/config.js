// Fill in your credentials here before deploying.
// See setup.sql for database schema.
const CONFIG = {
  supabase: {
    url: 'YOUR_SUPABASE_URL',           // e.g. https://xyzxyz.supabase.co
    anonKey: 'YOUR_SUPABASE_ANON_KEY',  // found in Project Settings > API
  },
  tmdb: {
    apiKey: 'YOUR_TMDB_API_KEY',        // free at https://www.themoviedb.org/settings/api
  },
  deadline: new Date('2026-05-08T00:00:00'), // picks lock at midnight May 8
  adminPassword: 'YOUR_ADMIN_PASSWORD',       // to access box office update panel
};
