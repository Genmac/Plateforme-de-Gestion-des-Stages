import { session } from "./session.js";

const CODES_SESSION_PERDUE = [
  "UNAUTHORIZED",
  "TOKEN_EXPIRED",
  "INVALID_TOKEN",
  "USER_NOT_FOUND",
  "ACCOUNT_DISABLED",
];

export async function apiFetch(endpoint, options = {}) {
  const headers = { ...options.headers };

  // Pas de Content-Type pour FormData : le navigateur ajoute la bonne frontière multipart
  const estFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!estFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const token = session.getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (session.isDevMode()) {
    // Envoi de l'en-tête de développement si aucun JWT n'est présent
    headers["x-dev-user"] = session.getDevUser();
  }

  let response;
  try {
    response = await fetch(`/api${endpoint}`, { ...options, headers });
  } catch {
    const e = new Error("Serveur injoignable. Vérifiez votre connexion.");
    e.code = "NETWORK_ERROR";
    throw e;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.success === false) {
    const erreur = new Error(
      data?.error?.message || "Erreur lors de la communication avec le serveur",
    );
    erreur.status = response.status;
    erreur.code = data?.error?.code;

    const surLogin = location.pathname.endsWith("login.html");
    const surMdp = location.pathname.endsWith("changer-mot-de-passe.html");
    if (
      CODES_SESSION_PERDUE.includes(erreur.code) &&
      !surLogin &&
      endpoint !== "/auth/login"
    ) {
      session.clear();
      location.replace("/login.html");
    } else if (erreur.code === "PASSWORD_CHANGE_REQUIRED" && !surMdp) {
      session.setPremiereConnexion(true);
      location.replace("/changer-mot-de-passe.html");
    }
    throw erreur;
  }

  return data;
}
