import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function checkSpecificTables() {
  console.log('🔍 Checking landing_pages and lead_magnets structures...');
  
  const tables = ['landing_pages', 'lead_magnets'];
  
  for (const tableName of tables) {
    console.log(`\n📋 Testing ${tableName}:`);
    
    try {
      // Test basic insert to see what works
      const { data, error } = await supabase
        .from(tableName)
        .insert({
          title: 'Test',
          slug: 'test-slug'
        })
        .select();
      
      if (!error && data) {
        console.log(`✅ Successful insert for ${tableName}`);
        console.log(`📋 Returned structure:`, Object.keys(data[0]));
        
        // Clean up
        await supabase
          .from(tableName)
          .delete()
          .eq('id', data[0].id);
      } else {
        console.log(`❌ Error for ${tableName}:`, error?.message);
      }
      
    } catch (err) {
      console.log(`❌ Exception for ${tableName}:`, err);
    }
  }
}

checkSpecificTables();