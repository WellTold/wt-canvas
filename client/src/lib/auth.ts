import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabase, getSessionTokenSync } from "./supabase";

export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  defaultTheme?: string | null;
  backgroundColor?: string | null;
  initials: string;
  role?: string | null;
}

function supabaseSessionToUser(session: any): User | null {
  if (!session?.user) return null;
  const user = session.user;
  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email || '',
    name: metadata.name || user.email || '',
    firstName: metadata.firstName || null,
    lastName: metadata.lastName || null,
    displayName: metadata.displayName || null,
    avatarUrl: metadata.avatarUrl || null,
    defaultTheme: metadata.defaultTheme || 'light',
    backgroundColor: metadata.backgroundColor || '#f0ebe7',
    initials: metadata.initials || (user.email || '').substring(0, 2).toUpperCase(),
    role: metadata.role || 'editor',
  };
}

export function useAuth() {
  return useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async (): Promise<User | null> => {
      const supabase = await getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      return supabaseSessionToUser(session);
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }): Promise<User> => {
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const user = supabaseSessionToUser(data.session);
      if (!user) throw new Error('Login succeeded but no user data returned');
      return user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const supabase = await getSupabase();
      await supabase.auth.signOut();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.invalidateQueries();
    },
  });
}

export { getSessionTokenSync };
