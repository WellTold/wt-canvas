import { Switch, Route, Redirect } from "wouter";
import { Component, type ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import SavedPages from "@/pages/SavedPages";
import BlockLibrary from "@/pages/BlockLibrary";
import SavedEmails from "@/pages/SavedEmails";
import EmailTemplates from "@/pages/EmailTemplates";
import EmailBuilder from "@/pages/EmailBuilder";
import EmailDeployment from "@/pages/EmailDeployment";
import BrandLogos from "@/pages/BrandLogos";
import LifestyleImages from "@/pages/LifestyleImages";
import CloudinaryAssets from "@/pages/CloudinaryAssets";
import CloudinaryTest from "@/pages/CloudinaryTest";
import Templates from "@/pages/Templates";
import TemplateBuilder from "@/pages/TemplateBuilder";
import AITemplateBuilder from "@/pages/AITemplateBuilder";
import TemplateDetail from "@/pages/TemplateDetail";
import ContentView from "@/components/content/ContentView";
import { ContentEditor } from "@/components/content/ContentEditor";
import Publisher from "@/pages/Publisher";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import BrandContext from "@/pages/BrandContext";
import Integrations from "@/pages/Integrations";
import SupabaseTest from "@/pages/SupabaseTest";
import SiteSettings from "@/pages/SiteSettings";
import Keywords from "@/pages/Keywords";
import ImageStudio from "@/pages/ImageStudio";
import ImageTemplates from "@/pages/ImageTemplates";
import WorkerDeployment from "@/pages/WorkerDeployment";
import SnippetsEditor from "@/pages/SnippetsEditor";
import NotFound from "@/pages/not-found";

class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-600 mb-4">{this.state.error.message}</p>
          <button
            className="px-4 py-2 bg-black text-white text-sm"
            onClick={() => { this.setState({ error: null }); window.history.back(); }}
          >
            Go Back
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <AppLayout>
      <PageErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          {/* Webpages */}
          <Route path="/pages" component={SavedPages} />
          <Route path="/pages/builder" component={() => <ContentEditor />} />
          <Route path="/pages/builder/:id">{(params) => <ContentEditor contentItemId={params.id} />}</Route>
          <Route path="/pages/deployment" component={Publisher} />
          {/* Legacy content routes — redirect to /pages */}
          <Route path="/blog-articles"><Redirect to="/pages" /></Route>
          <Route path="/lead-magnets"><Redirect to="/pages" /></Route>
          <Route path="/landing-pages"><Redirect to="/pages" /></Route>
          {/* Blocks */}
          <Route path="/blocks" component={BlockLibrary} />
          {/* Emails */}
          <Route path="/emails" component={SavedEmails} />
          <Route path="/email-templates" component={EmailTemplates} />
          <Route path="/email-builder" component={EmailBuilder} />
          <Route path="/email-builder/:id">{(params) => <EmailBuilder emailId={params.id} />}</Route>
          <Route path="/email-deployment" component={EmailDeployment} />
          {/* Templates */}
          <Route path="/templates" component={Templates} />
          <Route path="/templates/:id" component={TemplateDetail} />
          <Route path="/email-templates/:id" component={TemplateDetail} />
          <Route path="/template-builder" component={TemplateBuilder} />
          <Route path="/ai-template-builder" component={AITemplateBuilder} />
          {/* Content detail/editor */}
          <Route path="/content/:id" component={ContentView} />
          <Route path="/content-editor" component={() => <ContentEditor />} />
          <Route path="/content-editor/:id">{(params) => <ContentEditor contentItemId={params.id} />}</Route>
          {/* Publisher */}
          <Route path="/publisher" component={Publisher} />
          {/* Assets */}
          <Route path="/brand-logos" component={BrandLogos} />
          <Route path="/lifestyle-images" component={LifestyleImages} />
          <Route path="/cloudinary" component={CloudinaryAssets} />
          <Route path="/cloudinary-test" component={CloudinaryTest} />
          {/* Other */}
          <Route path="/site-settings" component={SiteSettings} />
          <Route path="/profile" component={Profile} />
          <Route path="/settings" component={Settings} />
          <Route path="/settings/brand-context" component={BrandContext} />
          <Route path="/integrations" component={Integrations} />
          <Route path="/keywords" component={Keywords} />
          <Route path="/content/create" component={ImageStudio} />
          <Route path="/content/image-templates" component={ImageTemplates} />
          <Route path="/supabase-test" component={SupabaseTest} />
          <Route path="/tools/worker-deployment" component={WorkerDeployment} />
          <Route path="/tools/snippets" component={SnippetsEditor} />
          <Route component={NotFound} />
        </Switch>
      </PageErrorBoundary>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
