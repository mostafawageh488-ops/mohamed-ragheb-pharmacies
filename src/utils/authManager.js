const DEFAULT_USERS = {
  "MWS2005": "1996",
  "mostafa.com": "2005"
};

const AUTH_STORAGE_KEY = 'mragheb_app_credentials';

export const getUsers = () => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_USERS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Error reading auth data", e);
  }
  return DEFAULT_USERS;
};

export const authenticate = (username, password) => {
  const users = getUsers();
  const validPass = users[username];
  
  if (validPass && validPass === password) {
    // Return user role info
    return {
      username,
      isAdmin: username === 'mostafa.com'
    };
  }
  return null;
};

export const updatePassword = (username, newPassword) => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    const customUsers = stored ? JSON.parse(stored) : {};
    
    customUsers[username] = newPassword;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(customUsers));
    return true;
  } catch (e) {
    console.error("Error updating password", e);
    return false;
  }
};
