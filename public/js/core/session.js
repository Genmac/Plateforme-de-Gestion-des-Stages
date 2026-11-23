export const session = {
  getToken() {
    return localStorage.getItem('token');
  },

  setToken(token) {
    localStorage.setItem('token', token);
  },

  getDevUser() {
    return localStorage.getItem('devUser') || '1'; // Par défaut ID 1 (admin) en dev
  },

  setDevUser(userIdOrEmail) {
    localStorage.setItem('devUser', userIdOrEmail);
  },

  getCurrentRole() {
    return localStorage.getItem('userRole') || 'admin';
  },

  setCurrentRole(role) {
    localStorage.setItem('userRole', role);
  },

  clear() {
    localStorage.removeItem('token');
    localStorage.removeItem('devUser');
    localStorage.removeItem('userRole');
  }
};
