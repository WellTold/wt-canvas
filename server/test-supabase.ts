import { supabaseLegacyPublisher } from './services/supabase-legacy';

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    // Test connection with a simple table check
    // Use timestamp to ensure unique slugs
    const timestamp = Date.now();
    const testContent = {
      title: 'Test Connection Article',
      content: [
        {
          type: 'heading' as const,
          level: 2,
          text: 'Supabase Connection Test'
        },
        {
          type: 'paragraph' as const,
          text: 'This is a test article to verify the Supabase connection with the new content_json structure.'
        }
      ],
      slug: `test-connection-article-${timestamp}`,
      type: 'blog' as const,
      excerpt: 'Test article for connection verification',
      author: 'Test Author',
      tags: ['test', 'connection']
    };

    console.log('📝 Testing blog article creation...');
    const result = await supabaseLegacyPublisher.publishBlogArticle(testContent);
    console.log('✅ Blog article test successful:', result);

    // Test other content types
    console.log('📝 Testing landing page creation...');
    const landingContent = {
      ...testContent,
      title: 'Test Landing Page',
      slug: `test-landing-page-${timestamp}`,
      type: 'landing_page' as const,
      headline: 'Welcome to Our Amazing Product',
      subheadline: 'Transform your workflow with our innovative solution',
      cta_text: 'Get Started Today',
      cta_url: '/signup'
    };
    const landingResult = await supabaseLegacyPublisher.publishLandingPage(landingContent);
    console.log('✅ Landing page test successful:', landingResult);

    console.log('📝 Testing lead magnet creation...');
    const leadContent = {
      ...testContent,
      title: 'Test Lead Magnet',
      slug: `test-lead-magnet-${timestamp}`,
      type: 'lead_magnet' as const,
      description: 'Download our comprehensive guide to get started',
      download_url: '/downloads/guide.pdf',
      image_url: '/images/guide-preview.jpg'
    };
    const leadResult = await supabaseLegacyPublisher.publishLeadMagnet(leadContent);
    console.log('✅ Lead magnet test successful:', leadResult);

    // Clean up all test content
    console.log('🧹 Cleaning up test content...');
    if (result.id) await supabaseLegacyPublisher.unpublishContent(result.id, 'blog_articles');
    if (landingResult.id) await supabaseLegacyPublisher.unpublishContent(landingResult.id, 'landing_pages');
    if (leadResult.id) await supabaseLegacyPublisher.unpublishContent(leadResult.id, 'lead_magnets');
    console.log('✅ Cleanup successful');

    console.log('🎉 Supabase connection test completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Supabase connection test failed:', error);
    
    // Check for common errors and provide helpful guidance
    if (error.message.includes('credentials')) {
      console.log('💡 Issue: The SUPABASE_URL appears to be a PostgreSQL connection string.');
      console.log('💡 Solution: Please use the Supabase REST API URL instead.');
      console.log('💡 The correct format should be: https://your-project.supabase.co');
      console.log('💡 You can find this in your Supabase Dashboard > Settings > API');
    } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('💡 Tip: The required database tables don\'t exist in your Supabase database.');
      console.log('💡 You may need to create the following tables:');
      console.log('   - blog_articles');
      console.log('   - landing_pages');
      console.log('   - lead_magnets');
    } else if (error.message.includes('Invalid API key')) {
      console.log('💡 Tip: Please check your SUPABASE_ANON_KEY is correct.');
    } else if (error.message.includes('Project not found')) {
      console.log('💡 Tip: Please check your SUPABASE_URL is correct.');
    }
    
    console.log('💡 Expected SUPABASE_URL format: https://your-project.supabase.co');
    console.log('💡 Current SUPABASE_URL starts with:', process.env.SUPABASE_URL?.substring(0, 30) + '...');

    return false;
  }
}

export { testSupabaseConnection };

// Run the test and show results
console.log('Starting Supabase connection test...');
testSupabaseConnection().then(result => {
  console.log('Test completed with result:', result);
}).catch(error => {
  console.error('Test failed with error:', error);
});