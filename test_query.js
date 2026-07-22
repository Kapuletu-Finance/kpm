const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
      .from('project_members')
      .select('*, members:member_id (id, first_name, email)')
      .eq('project_id', '3bb9aed9-1a43-46a0-8fb8-b2a359e83f44')
      .order('created_at', { ascending: true });
  console.log('Error:', error);
  console.log('Data:', data ? data.length : null);
}
check();
