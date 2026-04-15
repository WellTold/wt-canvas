import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkSupabaseSchema() {
  console.log('🔍 Checking existing Supabase schema...');
  
  // Try common table names that might exist
  const possibleTables = [
    'blog_articles', 'blogs', 'articles', 'posts',
    'landing_pages', 'pages', 'landingpages',
    'lead_magnets', 'leadmagnets', 'magnets',
    'content', 'content_items', 'contentitems'
  ];

  console.log('🔍 Testing for existing tables...');
  
  for (const tableName of possibleTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (!error) {
        console.log(`✅ Found table: ${tableName}`);
        
        // Try to get a sample row to see the structure
        if (data && data.length > 0) {
          console.log(`  Sample data structure:`, Object.keys(data[0]));
        } else {
          console.log(`  Table exists but is empty`);
        }
      }
    } catch (err) {
      // Table doesn't exist, skip silently
    }
  }

  // Try to use the REST API to get table information
  try {
    console.log('\n🔍 Attempting to list all available tables...');
    
    // Try a direct query to see what tables respond
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY!}`
      }
    });
    
    const text = await response.text();
    console.log('REST API response:', text.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('❌ Schema check failed:', error);
  }
}

// Run the schema check
checkSupabaseSchema();