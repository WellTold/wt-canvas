import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function inspectTableStructure() {
  console.log('🔍 Inspecting table structures...');
  
  const tables = ['blog_articles', 'landing_pages', 'lead_magnets', 'content_items'];
  
  for (const tableName of tables) {
    console.log(`\n📋 Table: ${tableName}`);
    
    try {
      // Try to insert a minimal test record to see what columns are required/available
      const testData = {
        title: 'Test Title',
        id: 999999 // Use high ID to avoid conflicts
      };
      
      const { error } = await supabase
        .from(tableName)
        .insert(testData);
      
      if (error) {
        console.log(`  Error details: ${error.message}`);
        
        // Extract column information from error message
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          const match = error.message.match(/column "([^"]+)" does not exist/);
          if (match) {
            console.log(`  ❌ Missing column: ${match[1]}`);
          }
        }
        
        if (error.message.includes('null value in column')) {
          const match = error.message.match(/null value in column "([^"]+)"/);
          if (match) {
            console.log(`  ⚠️  Required column: ${match[1]}`);
          }
        }
        
        if (error.message.includes('violates not-null constraint')) {
          const match = error.message.match(/column "([^"]+)" violates not-null constraint/);
          if (match) {
            console.log(`  ⚠️  Required column: ${match[1]}`);
          }
        }
      } else {
        console.log(`  ✅ Basic structure compatible`);
        
        // Clean up the test record
        await supabase
          .from(tableName)
          .delete()
          .eq('id', 999999);
      }
      
    } catch (err) {
      console.log(`  ❌ Failed to test: ${err}`);
    }
  }
  
  // Try to describe a successful insert for blog_articles
  console.log('\n🔍 Testing minimal successful insert for blog_articles...');
  
  const minimalFields = [
    { title: 'Test' },
    { title: 'Test', slug: 'test' },
    { title: 'Test', slug: 'test', content: 'test content' },
    { title: 'Test', slug: 'test', body: 'test content' },
    { title: 'Test', slug: 'test', text: 'test content' },
    { title: 'Test', slug: 'test', description: 'test content' }
  ];
  
  for (const testData of minimalFields) {
    try {
      const { data, error } = await supabase
        .from('blog_articles')
        .insert(testData)
        .select();
      
      if (!error && data) {
        console.log(`  ✅ Successful with fields:`, Object.keys(testData));
        console.log(`  📋 Returned data structure:`, Object.keys(data[0]));
        
        // Clean up
        await supabase
          .from('blog_articles')
          .delete()
          .eq('id', data[0].id);
        break;
      }
    } catch (err) {
      // Continue to next test
    }
  }
}

inspectTableStructure();