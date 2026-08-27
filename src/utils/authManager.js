import { supabase } from './supabaseClient';

const DEFAULT_USERS = [
  { id: 1, username: 'MWS2005', password: '1996' },
  { id: 2, username: 'mostafa.com', password: '2005' }
];

// Helper to seed defaults if table is empty
const seedDefaultsIfNeeded = async () => {
  try {
    const { count } = await supabase.from('app_users').select('*', { count: 'exact', head: true });
    if (count === 0) {
      await supabase.from('app_users').insert(DEFAULT_USERS);
    }
  } catch (e) {
    console.error("Error seeding defaults", e);
  }
};

export const getAllUsers = async () => {
  try {
    const { data, error } = await supabase.from('app_users').select('username');
    if (error) throw error;
    return data.map(u => u.username);
  } catch (e) {
    console.error("Error fetching users", e);
    return ['MWS2005', 'mostafa.com'];
  }
};

export const authenticate = async (username, password) => {
  await seedDefaultsIfNeeded();
  try {
    const { data, error } = await supabase.from('app_users')
      .select('*')
      .eq('username', username)
      .single();
      
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is '0 rows'
    
    if (data && data.password === password) {
      return {
        username,
        isAdmin: username === 'mostafa.com'
      };
    }
  } catch (e) {
    console.error("Authentication error", e);
  }
  return null;
};

export const updatePassword = async (username, newPassword) => {
  try {
    const { error } = await supabase.from('app_users')
      .update({ password: newPassword })
      .eq('username', username);
      
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Error updating password", e);
    return false;
  }
};
