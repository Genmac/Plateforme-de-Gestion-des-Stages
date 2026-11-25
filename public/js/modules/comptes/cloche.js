// Cloche des notifications avec compteur de non lues.
// Utilise routes/notifications.js du socle : GET /api/notifications et PATCH /api/notifications/:id/lire
import { apiFetch } from "../../core/api.js";
import { el, formaterDate } from "./helpers.js";

const ICONE =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.94 1.94 0 0 0 3.4 0"/></svg>';
const INTERVALLE_MS = 60000;

export function monterCloche(zone) {
  const badge = el("span", {
    class:
      "absolute -right-0.5 -top-0.5 hidden min-w-[1.1rem] rounded-full bg-red-600 px-1 text-center text-[11px] font-semibold leading-[1.1rem] text-white",
  });
  const icone = el("span", {});
  icone.innerHTML = ICONE;
  const bouton = el(
    "button",
    {
      type: "button",
      "aria-label": "Notifications",
      "aria-expanded": "false",
      class:
        "relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500",
    },
    icone,
    badge,
  );
  const liste = el("ul", {
    class: "max-h-80 divide-y divide-slate-100 overflow-auto",
  });
  const panneau = el(
    "div",
    {
      class:
        "absolute right-0 z-20 mt-2 hidden w-80 rounded-xl border border-slate-200 bg-white shadow-lg",
    },
    el(
      "div",
      { class: "border-b border-slate-100 px-4 py-2 text-sm font-semibold" },
      "Notifications",
    ),
    liste,
  );
  zone.classList.add("relative");
  zone.replaceChildren(bouton, panneau);

  function afficher(notifications) {
    const nonLues = notifications.filter((n) => !n.lu).length;
    badge.textContent = nonLues > 99 ? "99+" : String(nonLues);
    badge.classList.toggle("hidden", nonLues === 0);
    bouton.setAttribute(
      "aria-label",
      nonLues ? `Notifications, ${nonLues} non lues` : "Notifications",
    );
    liste.replaceChildren(
      ...(notifications.length
        ? notifications.map((n) =>
            el(
              "li",
              {},
              el(
                "button",
                {
                  type: "button",
                  class: `block w-full px-4 py-2 text-left hover:bg-slate-50 ${n.lu ? "" : "bg-indigo-50"}`,
                  onclick: async () => {
                    if (!n.lu) {
                      await apiFetch(`/notifications/${n.id}/lire`, {
                        method: "PATCH",
                      }).catch(() => {});
                      charger();
                    }
                  },
                },
                el(
                  "span",
                  {
                    class: `block text-sm ${n.lu ? "text-slate-600" : "font-semibold"}`,
                  },
                  n.message,
                ),
                el(
                  "span",
                  { class: "block text-xs text-slate-500" },
                  formaterDate(n.created_at, ""),
                ),
              ),
            ),
          )
        : [
            el(
              "li",
              { class: "px-4 py-4 text-sm text-slate-500" },
              "Aucune notification pour le moment.",
            ),
          ]),
    );
  }

  async function charger() {
    try {
      const { data } = await apiFetch("/notifications");
      afficher(data);
    } catch {
      /* la perte de session est gérée par apiFetch */
    }
  }

  const fermer = () => {
    panneau.classList.add("hidden");
    bouton.setAttribute("aria-expanded", "false");
  };
  bouton.addEventListener("click", () => {
    const ouvert = panneau.classList.toggle("hidden") === false;
    bouton.setAttribute("aria-expanded", String(ouvert));
    if (ouvert) charger();
  });
  document.addEventListener("click", (e) => {
    if (!zone.contains(e.target)) fermer();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fermer();
  });

  charger();
  setInterval(() => {
    if (!document.hidden) charger();
  }, INTERVALLE_MS);
}
