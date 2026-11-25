import { apiFetch } from "../../core/api.js";
import { session } from "../../core/session.js";

// Déjà connecté : on va directement à l'application
if (session.getToken()) {
  location.replace(
    session.getPremiereConnexion() ? "/changer-mot-de-passe.html" : "/",
  );
}

const form = document.getElementById("form-login");
const zoneErreur = document.getElementById("erreur");
const bouton = document.getElementById("bouton");

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  zoneErreur.textContent = "";
  bouton.disabled = true;
  bouton.textContent = "Connexion…";
  session.clear();
  try {
    const { data } = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: form.email.value,
        mot_de_passe: form.mot_de_passe.value,
      }),
    });
    session.setToken(data.token);
    session.setUser(data.utilisateur);
    session.setPremiereConnexion(data.premiere_connexion);
    location.replace(
      data.premiere_connexion ? "/changer-mot-de-passe.html" : "/",
    );
  } catch (e) {
    zoneErreur.textContent = e.message;
    form.mot_de_passe.value = "";
    form.mot_de_passe.focus();
    bouton.disabled = false;
    bouton.textContent = "Se connecter";
  }
});

// Mode développement (DEV_AUTH) : proposé uniquement en local
const lienDev = document.getElementById("lien-dev");
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  lienDev.hidden = false;
  lienDev.addEventListener("click", (ev) => {
    ev.preventDefault();
    session.clear();
    session.setDevUser("1");
    session.setCurrentRole("admin");
    location.replace("/");
  });
}
