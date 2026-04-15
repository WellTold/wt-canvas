import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/lib/auth";
import { useTheme } from "@/components/ui/ThemeProvider";
import { Sun, Moon, User, Settings, LogOut } from "lucide-react";
import { Link } from "wouter";
import type { User as UserType } from "@/lib/auth";

interface TopBarProps {
  user: UserType;
}

export function TopBar({ user }: TopBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const logout = useLogout();
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    logout.mutate();
    setIsDropdownOpen(false);
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // Extract first name from full name
  const firstName = user.name.split(' ')[0];
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <header className="wt-top-bar">
      <div></div>
      
      <div className="flex items-center gap-4 relative">
        <span className="text-sm font-medium">{firstName}</span>
        <div
          className="w-9 h-9 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center font-semibold text-sm cursor-pointer"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          {initials}
        </div>
        
        {isDropdownOpen && (
          <div className="absolute top-12 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 min-w-[180px] z-10">
            <Link href="/profile">
              <a 
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setIsDropdownOpen(false)}
              >
                <User className="h-4 w-4" />
                Profile
              </a>
            </Link>
            <Link href="/settings">
              <a 
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setIsDropdownOpen(false)}
              >
                <Settings className="h-4 w-4" />
                Settings
              </a>
            </Link>
            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <button 
              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
              onClick={toggleTheme}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {theme === "light" ? "Dark Mode" : "Light Mode"}
            </button>
            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
