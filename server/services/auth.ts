import { createClient } from '@supabase/supabase-js';

export async function seedUsers() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️ SUPABASE_SERVICE_ROLE_KEY not set — skipping user seeding. Create users manually in Supabase dashboard.');
    return;
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const usersToSeed = [
    { email: 'brian@welltolddesign.com', password: 'WTCanvas25!', name: 'Brian Johnson', initials: 'BJ' },
    { email: 'neil@welltolddesign.com', password: 'WTCanvas25!', name: 'Neil Johnson', initials: 'NJ' },
    { email: 'dan@welltolddesign.com', password: 'WTCanvas25!', name: 'Dan Miller', initials: 'DM' },
  ];

  let existingEmails: Set<string>;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
      console.error('❌ Failed to list users:', error.message);
      return;
    }
    existingEmails = new Set(data.users?.map((u: any) => u.email) || []);
  } catch (err) {
    console.error('❌ Error listing users:', err);
    return;
  }

  for (const userData of usersToSeed) {
    if (existingEmails.has(userData.email)) {
      console.log(`✓ User already exists: ${userData.email}`);
      continue;
    }

    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        name: userData.name,
        initials: userData.initials,
        role: 'editor',
        defaultTheme: 'light',
        backgroundColor: '#f0ebe7',
      }
    });

    if (error) {
      console.error(`❌ Failed to create user ${userData.email}:`, error.message);
    } else {
      console.log(`✅ Created user: ${userData.email}`);
      // Also upsert into profiles table (non-fatal if table doesn't exist yet)
      if (newUser?.user) {
        await supabaseAdmin.from('profiles').upsert({
          id: newUser.user.id,
          email: userData.email,
          name: userData.name,
          initials: userData.initials,
          role: 'editor',
          default_theme: 'light',
          background_color: '#f0ebe7',
        }, { onConflict: 'id' }).then(({ error: profileErr }) => {
          if (profileErr && !profileErr.message.includes('does not exist')) {
            console.warn(`⚠️ Could not upsert profile for ${userData.email}:`, profileErr.message);
          }
        });
      }
    }
  }

  // Backfill profiles for existing users (no-op if table doesn't exist)
  try {
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
    if (allUsers?.users) {
      for (const u of allUsers.users) {
        const meta = u.user_metadata || {};
        await supabaseAdmin.from('profiles').upsert({
          id: u.id,
          email: u.email || '',
          name: meta.name || u.email || '',
          initials: meta.initials || (u.email || '').substring(0, 2).toUpperCase(),
          role: meta.role || 'editor',
          default_theme: meta.defaultTheme || 'light',
          background_color: meta.backgroundColor || '#f0ebe7',
        }, { onConflict: 'id' });
      }
    }
  } catch {
    // profiles table may not exist yet — user needs to run sql-migrations/phase0a_profiles_table.sql
  }
}
