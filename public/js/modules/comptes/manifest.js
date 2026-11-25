// Manifeste du module A (Comptes & Utilisateurs), déclaré dans core/modules.js.
// `monter(conteneur)` est appelé par le routeur d'index.html quand la route est active.
export default {
  id: "comptes",
  label: "Utilisateurs",
  route: "#comptes",
  roles: ["admin"],
  monter: async (conteneur) => {
    const { monter } = await import("./vueUtilisateurs.js");
    return monter(conteneur);
  },
};
