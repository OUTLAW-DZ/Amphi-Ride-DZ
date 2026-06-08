const SUPABASE_URL = "https://qjyvfjnpjlgfgrjmbtlm.supabase.co"; // دير الرابط تاعك هنا
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqeXZmam5wamxnZmdyam1idGxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMTk5OTksImV4cCI6MjA5NDU5NTk5OX0.yMXIuMWLmHoMXjaqMQEEgElZN8h6ImrJlx2Z3Yy68aU";          // دير الـ anon key تاعك هنا

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);