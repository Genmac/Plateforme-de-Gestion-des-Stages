import { apiFetch } from "../../core/api.js";
import { session } from "../../core/session.js";

// Page réservée à la première connexion : jeton obligatoire (pas de mode DEV_AUTH)
if (!session.getToken()) location.replace("/login.html");
else if (!session.getPremiereConnexion()) location.replace("/");

document.getElementById("avis").textContent =
  "C’est votre première connexion. Choisissez votre mot de passe personnel pour accéder à la plateforme.";
document
  .getElementById("btn-logout")
  .addEventListener("click", () => session.logout());

const form = document.getElementById("form-mdp");
const zoneErreur = document.getElementById("erreur");
const bouton = document.getElementById("bouton");

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  zoneErreur.textContent = "";
  if (form.nouveau.value !== form.confirmation.value) {
    zoneErreur.textContent =
      "La confirmation ne correspond pas au nouveau mot de passe.";
    return;
  }
  bouton.disabled = true;
  try {
    const { data } = await apiFetch("/auth/changer-mot-de-passe", {
      method: "POST",
      body: JSON.stringify({
        ancien_mot_de_passe: form.ancien.value,
        nouveau_mot_de_passe: form.nouveau.value,
      }),
    });
    session.setToken(data.token);
    session.setPremiereConnexion(false);
    location.replace("/");
  } catch (e) {
    zoneErreur.textContent = e.message;
    bouton.disabled = false;
  }
});
