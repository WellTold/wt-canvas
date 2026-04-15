import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Database, 
  ExternalLink,
  AlertTriangle 
} from "lucide-react";

export default function SupabaseTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const runConnectionTest = async () => {
    setIsLoading(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/test/supabase', {
        method: 'GET',
        credentials: 'include'
      });
      
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to run connection test: ' + (error as Error).message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="wt-page">
      <div className="wt-page-header">
        <div>
          <h1 className="wt-page-title">Supabase Connection Test</h1>
          <p className="wt-page-description">
            Test and verify your Supabase database connection for content publishing.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="bg-white border border-black">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={runConnectionTest}
              disabled={isLoading}
              className="bg-black hover:bg-gray-800 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Test Supabase Connection
                </>
              )}
            </Button>

            {testResult && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <Badge className="bg-green-100 text-green-700">Connected</Badge>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      <Badge className="bg-red-100 text-red-700">Connection Failed</Badge>
                    </>
                  )}
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200">
                  <p className="text-sm font-mono">{testResult.message}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {testResult && testResult.success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Success!</strong> Your Supabase connection is working perfectly. Publishing functionality is ready to use.
            </AlertDescription>
          </Alert>
        )}
        
        {testResult && !testResult.success && testResult.message.includes('Could not find') && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Database Setup Required:</strong> The required tables don't exist in your Supabase database yet. 
              Please run the SQL schema provided below to create them.
            </AlertDescription>
          </Alert>
        )}

        <Card className="bg-white border border-black">
          <CardHeader>
            <CardTitle>Required Supabase Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">1. Get Your Supabase REST API URL</h3>
              <p className="text-sm text-gray-600">
                Go to your Supabase Dashboard → Settings → API
              </p>
              <div className="p-3 bg-gray-100 border border-gray-300 font-mono text-sm">
                Expected format: https://your-project.supabase.co
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">2. Get Your Anon Public Key</h3>
              <p className="text-sm text-gray-600">
                Also from Settings → API, copy the "anon" "public" key
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">3. Schema Options</h3>
              <p className="text-sm text-gray-600">
                You have existing tables with extended structure. Choose your approach:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 border border-gray-300 bg-blue-50">
                  <h4 className="font-medium text-blue-800 mb-2">Option A: Use Existing Tables</h4>
                  <p className="text-xs text-blue-700 mb-2">
                    Keep your current table structure with all existing fields
                  </p>
                  <div className="text-xs text-blue-600">
                    ✓ blog_articles (extended)<br/>
                    ✓ landing_pages (extended)<br/>
                    ✓ lead_magnets (extended)
                  </div>
                </div>
                
                <div className="p-3 border border-gray-300 bg-green-50">
                  <h4 className="font-medium text-green-800 mb-2">Option B: New Clean Schema</h4>
                  <p className="text-xs text-green-700 mb-2">
                    Create simplified tables optimized for Framer CMS
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-green-700 border-green-300"
                    onClick={() => window.open('https://supabase.com/dashboard/project/' + window.location.hostname.split('.')[0] + '/sql', '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Get Clean Schema SQL
                  </Button>
                </div>
              </div>
              
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-gray-700">View Clean Schema SQL</summary>
                <div className="p-3 bg-gray-100 border border-gray-300 font-mono text-xs max-h-40 overflow-y-auto mt-2">
                  {`-- New clean schema for Framer CMS
CREATE TABLE blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content_json JSONB NOT NULL,
  author TEXT,
  tags TEXT[] DEFAULT '{}'
);

CREATE TABLE landing_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  headline TEXT,
  subheadline TEXT,
  content_json JSONB NOT NULL,
  cta_text TEXT,
  cta_url TEXT
);

CREATE TABLE lead_magnets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  download_url TEXT,
  content_json JSONB NOT NULL,
  image_url TEXT
);`}
                </div>
              </details>
            </div>

            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Supabase Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}