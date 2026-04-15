export const authService = {
  getSession: () => {
    // קודם בודק אם יש "זכור אותי" (localStorage)
    const local = localStorage.getItem('fantasy_user');
    if (local) return JSON.parse(local);
    
    // אם אין, בודק אם יש סשן זמני
    const session = sessionStorage.getItem('fantasy_user');
    if (session) return JSON.parse(session);
    
    return null;
  },
  login: (user: any, rememberMe: boolean) => {
    if (rememberMe) {
      localStorage.setItem('fantasy_user', JSON.stringify(user));
      sessionStorage.removeItem('fantasy_user');
    } else {
      sessionStorage.setItem('fantasy_user', JSON.stringify(user));
      localStorage.removeItem('fantasy_user');
    }
  },
  logout: () => {
    localStorage.removeItem('fantasy_user');
    sessionStorage.removeItem('fantasy_user');
  }
};