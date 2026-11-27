// Vue « Utilisateurs » (administration) : CRUD complet.
//   Lire    : liste paginée + recherche/filtres, fiche dans la fenêtre « Modifier »
//   Créer   : formulaire (mot de passe temporaire affiché une fois) + import CSV
//   Modifier: nom, prénom, e-mail, rôle et profil dans UNE seule fenêtre (PUT /utilisateurs/:id)
//   Supprimer (logique) : désactiver / réactiver
import { apiFetch } from "../../core/api.js";
import { session } from "../../core/session.js";
import {
  el,
  LIBELLES_ROLES,
  formaterDate,
  CLASSE_CHAMP,
  CLASSE_BOUTON,
  CLASSE_BOUTON_SECONDAIRE,
} from "./helpers.js";

const TEMPLATE = `
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h3 class="text-xl font-semibold">Utilisateurs</h3>
    <div class="flex gap-2">
      <button id="cpt-btn-import" type="button" class="${CLASSE_BOUTON_SECONDAIRE}">Importer des étudiants (CSV)</button>
      <button id="cpt-btn-creer" type="button" class="${CLASSE_BOUTON}">Créer un compte</button>
    </div>
  </div>

  <p id="cpt-message" role="status" aria-live="polite" class="mt-3 min-h-[1.25rem] text-sm text-emerald-700"></p>

  <div class="mt-2 flex flex-wrap gap-3">
    <input id="cpt-recherche" type="search" placeholder="Rechercher par nom, prénom ou e-mail" aria-label="Rechercher"
      class="min-w-[16rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
    <select id="cpt-filtre-role" aria-label="Filtrer par rôle" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
      <option value="">Tous les rôles</option>
      <option value="admin">Administration</option>
      <option value="responsable">Responsable des stages</option>
      <option value="etudiant">Étudiant</option>
      <option value="entreprise">Entreprise (tuteur)</option>
    </select>
    <select id="cpt-filtre-statut" aria-label="Filtrer par statut" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
      <option value="">Tous les statuts</option>
      <option value="actif">Actifs</option>
      <option value="desactive">Désactivés</option>
    </select>
  </div>

  <div class="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-slate-200 bg-slate-50 text-slate-600">
        <tr>
          <th class="px-4 py-2 font-medium">Nom</th><th class="px-4 py-2 font-medium">E-mail</th>
          <th class="px-4 py-2 font-medium">Rôle</th><th class="px-4 py-2 font-medium">Statut</th>
          <th class="px-4 py-2 font-medium">Dernière connexion</th><th class="px-4 py-2 text-right font-medium">Actions</th>
        </tr>
      </thead>
      <tbody id="cpt-corps" class="divide-y divide-slate-100"></tbody>
    </table>
  </div>
  <div class="mt-3 flex items-center justify-between text-sm text-slate-600">
    <span id="cpt-resume"></span>
    <div class="flex gap-2">
      <button id="cpt-precedent" type="button" class="${CLASSE_BOUTON_SECONDAIRE}">Précédent</button>
      <button id="cpt-suivant" type="button" class="${CLASSE_BOUTON_SECONDAIRE}">Suivant</button>
    </div>
  </div>

  <!-- Création -->
  <dialog id="cpt-dlg-creer" class="w-full max-w-lg rounded-xl p-0 backdrop:bg-slate-900/40">
    <div class="p-6">
      <h3 class="text-lg font-semibold">Créer un compte</h3>
      <form id="cpt-form-creer" class="mt-4 space-y-3" novalidate>
        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm">Nom *<input name="nom" required class="${CLASSE_CHAMP}"></label>
          <label class="block text-sm">Prénom *<input name="prenom" required class="${CLASSE_CHAMP}"></label>
        </div>
        <label class="block text-sm">E-mail *<input name="email" type="email" required class="${CLASSE_CHAMP}"></label>
        <label class="block text-sm">Rôle *
          <select name="role" class="${CLASSE_CHAMP}">
            <option value="etudiant">Étudiant</option>
            <option value="entreprise">Entreprise (tuteur)</option>
            <option value="responsable">Responsable des stages</option>
            <option value="admin">Administration</option>
          </select>
        </label>
        <div id="cpt-champs-profil" class="space-y-3"></div>
        <p id="cpt-erreur-creation" role="alert" class="text-sm text-red-600"></p>
        <div class="flex justify-end gap-2 pt-2">
          <button id="cpt-annuler-creation" type="button" class="${CLASSE_BOUTON_SECONDAIRE}">Annuler</button>
          <button id="cpt-valider-creation" type="submit" class="${CLASSE_BOUTON}">Créer le compte</button>
        </div>
      </form>
      <div id="cpt-resultat-creation" hidden>
        <p class="mt-4 font-medium">Compte créé</p>
        <p id="cpt-identite" class="text-sm text-slate-600"></p>
        <p class="mt-4 text-sm">Mot de passe temporaire à transmettre à la personne :</p>
        <div class="mt-1 flex items-center gap-2">
          <code id="cpt-mdp" class="rounded-lg bg-slate-100 px-3 py-2 text-lg tracking-wide"></code>
          <button id="cpt-copier" type="button" class="${CLASSE_BOUTON_SECONDAIRE}">Copier</button>
        </div>
        <p class="mt-2 text-xs text-slate-500">Il ne sera plus affiché après la fermeture de cette fenêtre. La personne devra le changer à sa première connexion.</p>
        <div class="mt-4 flex justify-end"><button id="cpt-fermer-creation" type="button" class="${CLASSE_BOUTON}">Fermer</button></div>
      </div>
    </div>
  </dialog>

  <!-- Modification -->
  <dialog id="cpt-dlg-modifier" class="w-full max-w-lg rounded-xl p-0 backdrop:bg-slate-900/40">
    <div class="p-6">
      <h3 class="text-lg font-semibold">Modifier le compte</h3>
      <p id="cpt-info-modif" class="mt-1 text-sm text-slate-500"></p>
      <form id="cpt-form-modifier" class="mt-4 space-y-3" novalidate>
        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm">Nom *<input name="nom" required class="${CLASSE_CHAMP}"></label>
          <label class="block text-sm">Prénom *<input name="prenom" required class="${CLASSE_CHAMP}"></label>
        </div>
        <label class="block text-sm">E-mail *<input name="email" type="email" required class="${CLASSE_CHAMP}"></label>
        <label class="block text-sm">Rôle *
          <select id="cpt-role-modif" name="role" class="${CLASSE_CHAMP}">
            <option value="etudiant">Étudiant</option>
            <option value="entreprise">Entreprise (tuteur)</option>
            <option value="responsable">Responsable des stages</option>
            <option value="admin">Administration</option>
          </select>
          <span id="cpt-aide-role-modif" class="mt-1 block text-xs text-slate-500" hidden>Vous ne pouvez pas modifier votre propre rôle.</span>
        </label>
        <div id="cpt-champs-profil-modif" class="space-y-3"></div>
        <p id="cpt-avert-role-modif" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" hidden></p>
        <p id="cpt-erreur-modif" role="alert" class="text-sm text-red-600"></p>
        <div class="flex justify-end gap-2 pt-2">
          <button id="cpt-annuler-modif" type="button" class="${CLASSE_BOUTON_SECONDAIRE}">Annuler</button>
          <button id="cpt-valider-modif" type="submit" class="${CLASSE_BOUTON}">Enregistrer</button>
        </div>
      </form>
    </div>
  </dialog>

  <!-- Import CSV -->
  <dialog id="cpt-dlg-import" class="w-full max-w-2xl rounded-xl p-0 backdrop:bg-slate-900/40">
    <div class="p-6">
      <h3 class="text-lg font-semibold">Importer des étudiants</h3>
      <p class="mt-2 text-sm text-slate-600">Fichier .csv, 500 lignes maximum. Colonnes : nom, prenom, email (obligatoires), filiere, niveau.
        Les lignes en erreur sont listées sans bloquer les autres.
        <a id="cpt-modele" download="modele-etudiants.csv" class="text-indigo-600 underline">Télécharger le modèle</a></p>
      <form id="cpt-form-import" class="mt-4 flex flex-wrap items-center gap-3">
        <input id="cpt-fichier" type="file" accept=".csv,text/csv" required class="text-sm">
        <button id="cpt-valider-import" type="submit" class="${CLASSE_BOUTON}">Importer</button>
      </form>
      <div id="cpt-resultat-import" class="mt-4" aria-live="polite"></div>
      <div class="mt-4 flex justify-end"><button id="cpt-fermer-import" type="button" class="${CLASSE_BOUTON_SECONDAIRE}">Fermer</button></div>
    </div>
  </dialog>
`;

const CHAMPS_PROFIL = {
  etudiant: [
    { nom: "filiere", libelle: "Filière" },
    { nom: "niveau", libelle: "Niveau" },
  ],
  entreprise: [
    {
      nom: "entreprise_id",
      libelle: "Entreprise",
      requis: true,
      type: "entreprise",
    },
    { nom: "fonction", libelle: "Fonction" },
  ],
  responsable: [],
  admin: [],
};

const MODELE_CSV =
  "nom,prenom,email,filiere,niveau\nDiop,Awa,awa.diop@exemple.sn,Génie Informatique,Licence 3\n";

export async function monter(conteneur) {
  conteneur.innerHTML = TEMPLATE;
  const $ = (id) => conteneur.querySelector(`#cpt-${id}`);
  const moi = session.getUser();
  const etat = { page: 1, limite: 20, q: "", role: "", statut: "" };

  // ------------------------------------------------------------ outils communs
  let minuteurMessage;
  function afficherMessage(texte) {
    $("message").textContent = texte;
    clearTimeout(minuteurMessage);
    minuteurMessage = setTimeout(() => {
      $("message").textContent = "";
    }, 5000);
  }

  let entreprises = null;
  async function chargerEntreprises() {
    if (!entreprises) {
      try {
        entreprises = (await apiFetch("/utilisateurs/options/entreprises"))
          .data;
      } catch {
        entreprises = [];
      }
    }
    return entreprises;
  }

  /** Affiche les champs du profil d'un rôle dans `zone`, préremplis avec `valeurs`. */
  async function afficherChampsProfil(zone, role, valeurs = {}) {
    zone.replaceChildren();
    for (const c of CHAMPS_PROFIL[role] || []) {
      let champ;
      if (c.type === "entreprise") {
        const liste = await chargerEntreprises();
        champ = el(
          "select",
          { name: `profil.${c.nom}`, required: true, class: CLASSE_CHAMP },
          el(
            "option",
            { value: "" },
            liste.length
              ? "Choisir une entreprise"
              : "Aucune entreprise enregistrée",
          ),
          liste.map((e) =>
            el(
              "option",
              {
                value: e.id,
                selected: String(e.id) === String(valeurs[c.nom]),
              },
              e.raison_sociale,
            ),
          ),
        );
      } else {
        champ = el("input", {
          name: `profil.${c.nom}`,
          value: valeurs[c.nom] ?? "",
          class: CLASSE_CHAMP,
        });
      }
      zone.append(
        el(
          "label",
          { class: "block text-sm" },
          c.libelle + (c.requis ? " *" : ""),
          champ,
        ),
      );
    }
    if (role === "entreprise" && !(await chargerEntreprises()).length) {
      zone.append(
        el(
          "p",
          { class: "text-sm text-amber-700" },
          "Enregistrez d’abord l’entreprise d’accueil avant de rattacher un tuteur.",
        ),
      );
    }
  }

  /** Lit les champs `profil.*` d'un formulaire sous forme { champ: valeur }. */
  function lireProfil(formulaire) {
    const profil = {};
    for (const [nom, valeur] of new FormData(formulaire)) {
      if (nom.startsWith("profil.")) profil[nom.slice(7)] = valeur;
    }
    return profil;
  }

  // ------------------------------------------------------------ liste
  async function charger() {
    const params = new URLSearchParams({
      page: etat.page,
      limite: etat.limite,
    });
    ["q", "role", "statut"].forEach((k) => etat[k] && params.set(k, etat[k]));
    try {
      const { data, meta } = await apiFetch(`/utilisateurs?${params}`);
      $("corps").replaceChildren(
        ...(data.length
          ? data.map(ligne)
          : [
              el(
                "tr",
                {},
                el(
                  "td",
                  { colspan: 6, class: "px-4 py-8 text-center text-slate-500" },
                  etat.q || etat.role || etat.statut
                    ? "Aucun utilisateur ne correspond à ces critères."
                    : "Aucun utilisateur. Créez le premier compte.",
                ),
              ),
            ]),
      );
      const pages = Math.max(1, Math.ceil(meta.total / etat.limite));
      $("resume").textContent =
        `${meta.total} utilisateur${meta.total > 1 ? "s" : ""} · page ${etat.page} sur ${pages}`;
      $("precedent").disabled = etat.page <= 1;
      $("suivant").disabled = etat.page >= pages;
    } catch (e) {
      $("corps").replaceChildren(
        el(
          "tr",
          {},
          el("td", { colspan: 6, class: "px-4 py-6 text-red-600" }, e.message),
        ),
      );
    }
  }

  const action = (libelle, couleur, onclick) =>
    el(
      "button",
      { type: "button", class: `hover:underline ${couleur}`, onclick },
      libelle,
    );

  async function basculerStatut(u, actif) {
    if (
      actif &&
      !confirm(
        `Désactiver le compte de ${u.prenom} ${u.nom} ? Cette personne ne pourra plus se connecter.`,
      )
    )
      return;
    try {
      await apiFetch(
        `/utilisateurs/${u.id}/${actif ? "desactiver" : "activer"}`,
        { method: "PATCH" },
      );
      afficherMessage(
        `Compte de ${u.prenom} ${u.nom} ${actif ? "désactivé" : "réactivé"}.`,
      );
      charger();
    } catch (e) {
      alert(e.message);
    }
  }

  function ligne(u) {
    const actif = u.statut === "actif";
    const estMoi = !!moi && u.id === moi.id;
    return el(
      "tr",
      { class: actif ? "" : "bg-slate-50 text-slate-400" },
      el("td", { class: "px-4 py-2 font-medium" }, `${u.prenom} ${u.nom}`),
      el("td", { class: "px-4 py-2" }, u.email),
      el("td", { class: "px-4 py-2" }, LIBELLES_ROLES[u.role] || u.role || "—"),
      el(
        "td",
        { class: "px-4 py-2" },
        el(
          "span",
          {
            class: `rounded-full px-2 py-0.5 text-xs ${actif ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`,
          },
          actif ? "Actif" : "Désactivé",
        ),
        actif && u.premiere_connexion
          ? el(
              "span",
              { class: "ml-2 text-xs text-amber-600" },
              "Mot de passe à changer",
            )
          : null,
      ),
      el("td", { class: "px-4 py-2" }, formaterDate(u.derniere_connexion)),
      el(
        "td",
        { class: "px-4 py-2" },
        el(
          "div",
          { class: "flex justify-end gap-3 text-sm" },
          action("Modifier", "text-indigo-600", () => ouvrirModification(u)),
          estMoi
            ? null
            : action(
                actif ? "Désactiver" : "Réactiver",
                actif ? "text-red-600" : "text-indigo-600",
                () => basculerStatut(u, actif),
              ),
        ),
      ),
    );
  }

  let minuterie;
  $("recherche").addEventListener("input", (e) => {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      etat.q = e.target.value.trim();
      etat.page = 1;
      charger();
    }, 300);
  });
  $("filtre-role").addEventListener("change", (e) => {
    etat.role = e.target.value;
    etat.page = 1;
    charger();
  });
  $("filtre-statut").addEventListener("change", (e) => {
    etat.statut = e.target.value;
    etat.page = 1;
    charger();
  });
  $("precedent").addEventListener("click", () => {
    etat.page -= 1;
    charger();
  });
  $("suivant").addEventListener("click", () => {
    etat.page += 1;
    charger();
  });

  // ------------------------------------------------------------ création
  const formCreer = $("form-creer");

  $("btn-creer").addEventListener("click", () => {
    formCreer.reset();
    formCreer.hidden = false;
    $("resultat-creation").hidden = true;
    $("erreur-creation").textContent = "";
    afficherChampsProfil($("champs-profil"), formCreer.role.value);
    $("dlg-creer").showModal();
  });
  formCreer.role.addEventListener("change", (e) =>
    afficherChampsProfil($("champs-profil"), e.target.value),
  );
  $("annuler-creation").addEventListener("click", () => $("dlg-creer").close());
  $("fermer-creation").addEventListener("click", () => $("dlg-creer").close());

  formCreer.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    $("erreur-creation").textContent = "";
    const profil = {};
    for (const [nom, valeur] of Object.entries(lireProfil(formCreer))) {
      if (valeur !== "") profil[nom] = valeur;
    }
    $("valider-creation").disabled = true;
    try {
      const { data } = await apiFetch("/utilisateurs", {
        method: "POST",
        body: JSON.stringify({
          nom: formCreer.nom.value,
          prenom: formCreer.prenom.value,
          email: formCreer.email.value,
          role: formCreer.role.value,
          profil,
        }),
      });
      formCreer.hidden = true;
      $("resultat-creation").hidden = false;
      $("identite").textContent =
        `${data.utilisateur.prenom} ${data.utilisateur.nom} · ${data.utilisateur.email}`;
      $("mdp").textContent = data.mot_de_passe_temporaire;
      $("copier").textContent = "Copier";
      charger();
    } catch (e) {
      $("erreur-creation").textContent = e.message;
    } finally {
      $("valider-creation").disabled = false;
    }
  });
  $("copier").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("mdp").textContent);
      $("copier").textContent = "Copié";
    } catch {
      /* ignoré */
    }
  });

  // ------------------------------------------------------------ modification (PUT /utilisateurs/:id)
  const formModifier = $("form-modifier");
  const selectRole = $("role-modif");
  let edition = null; // { id, role, estMoi, initial: { nom, prenom, email, profil } }

  /** Champs du profil + avertissement selon le rôle sélectionné. */
  async function mettreAJourProfilModif() {
    const nouveau = selectRole.value;
    const identique = nouveau === edition.role;
    // Même rôle : profil actuel prérempli. Autre rôle : profil vierge à renseigner.
    await afficherChampsProfil(
      $("champs-profil-modif"),
      nouveau,
      identique ? edition.initial.profil : {},
    );
    const avert = $("avert-role-modif");
    const ancien = CHAMPS_PROFIL[edition.role] || [];
    avert.hidden = identique;
    avert.textContent = identique
      ? ""
      : `Changement de « ${LIBELLES_ROLES[edition.role] || edition.role} » vers « ${LIBELLES_ROLES[nouveau]} ».` +
        (ancien.length
          ? ` Le profil actuel (${ancien.map((c) => c.libelle.toLowerCase()).join(", ")}) sera supprimé.`
          : "") +
        ((CHAMPS_PROFIL[nouveau] || []).length
          ? " Renseignez le profil du nouveau rôle."
          : "");
  }

  async function ouvrirModification(u) {
    let detail;
    try {
      detail = (await apiFetch(`/utilisateurs/${u.id}`)).data;
    } catch (e) {
      alert(e.message);
      return;
    }
    formModifier.reset();
    $("erreur-modif").textContent = "";
    formModifier.nom.value = detail.nom;
    formModifier.prenom.value = detail.prenom;
    formModifier.email.value = detail.email;
    $("info-modif").textContent =
      `${detail.statut === "actif" ? "Actif" : "Désactivé"} · dernière connexion : ${formaterDate(detail.derniere_connexion)}`;
    const estMoi = !!moi && detail.id === moi.id;
    edition = {
      id: detail.id,
      role: detail.role,
      estMoi,
      initial: {
        nom: detail.nom,
        prenom: detail.prenom,
        email: detail.email,
        profil: detail.profil || {},
      },
    };
    selectRole.value = detail.role;
    selectRole.disabled = estMoi; // le serveur refuse aussi l'auto-changement de rôle
    $("aide-role-modif").hidden = !estMoi;
    await mettreAJourProfilModif();
    $("dlg-modifier").showModal();
  }

  selectRole.addEventListener("change", mettreAJourProfilModif);
  $("annuler-modif").addEventListener("click", () => $("dlg-modifier").close());

  formModifier.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    $("erreur-modif").textContent = "";

    // On n'envoie que ce qui a changé (modification partielle)
    const corps = {};
    for (const champ of ["nom", "prenom", "email"]) {
      const valeur = formModifier[champ].value.trim();
      if (valeur !== edition.initial[champ]) corps[champ] = valeur;
    }

    const roleChange = selectRole.value !== edition.role;
    if (roleChange) {
      // Autre rôle : le profil du nouveau rôle est envoyé en entier
      corps.role = selectRole.value;
      corps.profil = {};
      for (const [nom, valeur] of Object.entries(lireProfil(formModifier))) {
        if (valeur !== "") corps.profil[nom] = valeur;
      }
    } else {
      // Même rôle : seulement les champs du profil réellement modifiés
      const profil = {};
      for (const [nom, valeur] of Object.entries(lireProfil(formModifier))) {
        if (String(valeur) !== String(edition.initial.profil[nom] ?? ""))
          profil[nom] = valeur;
      }
      if (Object.keys(profil).length) corps.profil = profil;
    }

    if (!Object.keys(corps).length) {
      $("erreur-modif").textContent = "Aucune modification à enregistrer.";
      return;
    }

    $("valider-modif").disabled = true;
    try {
      const { data } = await apiFetch(`/utilisateurs/${edition.id}`, {
        method: "PUT",
        body: JSON.stringify(corps),
      });
      if (edition.estMoi) session.setUser({ ...moi, ...data }); // garde la session à jour
      $("dlg-modifier").close();
      afficherMessage(
        roleChange
          ? `Compte de ${data.prenom} ${data.nom} mis à jour : nouveau rôle « ${LIBELLES_ROLES[data.role]} ».`
          : `Compte de ${data.prenom} ${data.nom} mis à jour.`,
      );
      charger();
    } catch (e) {
      $("erreur-modif").textContent = e.message;
    } finally {
      $("valider-modif").disabled = false;
    }
  });

  // ------------------------------------------------------------ import CSV
  $("modele").href =
    `data:text/csv;charset=utf-8,${encodeURIComponent(MODELE_CSV)}`;
  $("btn-import").addEventListener("click", () => {
    $("form-import").reset();
    $("resultat-import").replaceChildren();
    $("dlg-import").showModal();
  });
  $("fermer-import").addEventListener("click", () => $("dlg-import").close());

  const celluleCsv = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // neutralise l'injection de formules (Excel)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  $("form-import").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const sortie = $("resultat-import");
    const fichier = $("fichier").files[0];
    if (!fichier) return;
    const fd = new FormData();
    fd.append("fichier", fichier);
    $("valider-import").disabled = true;
    sortie.replaceChildren(
      el(
        "p",
        { class: "text-sm text-slate-500" },
        "Import en cours… (quelques secondes pour les gros fichiers)",
      ),
    );
    try {
      const { data: r } = await apiFetch("/utilisateurs/import-etudiants", {
        method: "POST",
        body: fd,
      });
      const blocs = [
        el(
          "p",
          { class: "font-medium" },
          `${r.crees} compte${r.crees > 1 ? "s" : ""} créé${r.crees > 1 ? "s" : ""} sur ${r.total_lignes} ligne${r.total_lignes > 1 ? "s" : ""}.`,
        ),
      ];
      if (r.comptes.length) {
        blocs.push(
          el(
            "button",
            {
              type: "button",
              class: `mt-2 ${CLASSE_BOUTON}`,
              onclick: () => {
                const csv = [
                  "nom;prenom;email;mot_de_passe_temporaire",
                  ...r.comptes.map((c) =>
                    [c.nom, c.prenom, c.email, c.mot_de_passe_temporaire]
                      .map(celluleCsv)
                      .join(";"),
                  ),
                ].join("\n");
                const a = el("a", {
                  href: URL.createObjectURL(
                    new Blob([`\ufeff${csv}`], { type: "text/csv" }),
                  ),
                  download: "identifiants-etudiants.csv",
                });
                a.click();
                URL.revokeObjectURL(a.href);
              },
            },
            "Télécharger les mots de passe temporaires",
          ),
          el(
            "p",
            { class: "mt-1 text-xs text-slate-500" },
            "Ils ne seront plus affichables après la fermeture de cette fenêtre.",
          ),
        );
      }
      if (r.erreurs.length) {
        blocs.push(
          el(
            "p",
            { class: "mt-4 font-medium text-red-600" },
            `${r.erreurs.length} ligne${r.erreurs.length > 1 ? "s" : ""} non importée${r.erreurs.length > 1 ? "s" : ""} :`,
          ),
          el(
            "div",
            { class: "max-h-48 overflow-auto" },
            el(
              "table",
              { class: "w-full text-sm" },
              el(
                "thead",
                {},
                el(
                  "tr",
                  { class: "text-left text-slate-500" },
                  el("th", { class: "py-1 pr-3" }, "Ligne"),
                  el("th", { class: "py-1 pr-3" }, "E-mail"),
                  el("th", { class: "py-1" }, "Motif"),
                ),
              ),
              el(
                "tbody",
                {},
                r.erreurs.map((e) =>
                  el(
                    "tr",
                    { class: "border-t border-slate-100 align-top" },
                    el("td", { class: "py-1 pr-3" }, e.ligne),
                    el("td", { class: "py-1 pr-3" }, e.email),
                    el("td", { class: "py-1" }, e.motif),
                  ),
                ),
              ),
            ),
          ),
        );
      }
      sortie.replaceChildren(...blocs);
      charger();
    } catch (e) {
      sortie.replaceChildren(
        el("p", { class: "text-sm text-red-600" }, e.message),
      );
    } finally {
      $("valider-import").disabled = false;
    }
  });

  charger();
}
