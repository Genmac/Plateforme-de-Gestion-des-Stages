export const session = {
  getToken() {
    return localStorage.getItem("token");
  },

  setToken(token) {
    localStorage.setItem("token", token);
  },

  getDevUser() {
    return localStorage.getItem("devUser") || "1"; // Par défaut ID 1 (admin) en dev
  },

  setDevUser(userIdOrEmail) {
    localStorage.setItem("devUser", userIdOrEmail);
  },

  // Vrai si le mode DEV_AUTH a été choisi explicitement (lien de la page de connexion ou sélecteur)
  isDevMode() {
    return localStorage.getItem("devUser") !== null;
  },

  getCurrentRole() {
    return localStorage.getItem("userRole") || "admin";
  },

  setCurrentRole(role) {
    localStorage.setItem("userRole", role);
  },

  // Utilisateur connecté (module Comptes) : { id, nom, prenom, email, role, ... }
  getUser() {
    try {
      return JSON.parse(localStorage.getItem("utilisateur"));
    } catch {
      return null;
    }
  },

  setUser(utilisateur) {
    localStorage.setItem("utilisateur", JSON.stringify(utilisateur));
    this.setCurrentRole(utilisateur.role);
  },

  getPremiereConnexion() {
    return localStorage.getItem("premiereConnexion") === "true";
  },

  setPremiereConnexion(valeur) {
    localStorage.setItem("premiereConnexion", String(!!valeur));
  },

  clear() {
    localStorage.removeItem("token");
    localStorage.removeItem("devUser");
    localStorage.removeItem("userRole");
    localStorage.removeItem("utilisateur");
    localStorage.removeItem("premiereConnexion");
  },

  // Déconnexion : le jeton est sans état côté serveur, il suffit de l'effacer
  logout() {
    this.clear();
    location.href = "/login.html";
  },
};
