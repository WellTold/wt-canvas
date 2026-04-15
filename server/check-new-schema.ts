import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function checkNewSchema() {
  console.log('🔍 Checking for new schema tables...');
  
  const newTables = ['blog_posts', 'landing_pages', 'lead_magnets'];
  
  for (const tableName of newTables) {
    console.log(`\n📋 Testing ${tableName}:`);
    
    try {
      // Try simple select to see if table exists
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (!error) {
        console.log(`✅ Table ${tableName} exists`);
        if (data && data.length > 0) {
          console.log(`📋 Structure:`, Object.keys(data[0]));
        } else {
          console.log(`📋 Table exists but is empty`);
        }
      } else {
        console.log(`❌ Table ${tableName} does not exist:`, error.message);
      }
      
    } catch (err) {
      console.log(`❌ Exception for ${tableName}:`, err);
    }
  }
  
  // Test if we can insert with the new schema
  console.log('\n🔍 Testing new schema insert for blog_posts...');
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        title: 'Test New Schema',
        slug: 'test-new-schema-' + Date.now(),
        excerpt: 'Test excerpt',
        content_json: [
          { type: 'heading', level: 2, text: 'Test Heading' },
          { type: 'paragraph', text: 'Test paragraph content' }
        ],
        author: 'Test Author',
        tags: ['test']
      })
      .select();
    
    if (!error && data) {
      console.log('✅ New schema insert successful:', data[0]);
      // Clean up
      await supabase.from('blog_posts').delete().eq('id', data[0].id);
    } else {
      console.log('❌ New schema insert failed:', error?.message);
    }
  } catch (err) {
    console.log('❌ Exception during new schema test:', err);
  }
}

checkNewSchema();