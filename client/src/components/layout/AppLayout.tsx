import { useAuth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { data: user, isLoading, error } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Handle authentication errors or missing user
  if (error || !user) {
    return <LoginForm />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="wt-main-content flex-1">
        <TopBar user={user} />
        <div className="wt-content-area">
          {children}
        </div>
      </div>
    </div>
  );
}