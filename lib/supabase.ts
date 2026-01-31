
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://woipxdpgtsfjginnaqdm.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvaXB4ZHBndHNmamdpbm5hcWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTk1MTksImV4cCI6MjA4NTM5NTUxOX0.z4L4vGvocOrdeFDB4ePXQSCSA6qzlbA_2EBUZohNgu0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
