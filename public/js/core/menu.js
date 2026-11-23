import { modulesManifest } from './modules.js';
import { session } from './session.js';

export function renderMenu(containerId = 'sidebar-menu') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentRole = session.getCurrentRole();
  const allowedModules = modulesManifest.filter(mod => mod.roles.includes(currentRole));

  container.innerHTML = allowedModules.map(mod => `
    <a href="${mod.route}" 
       class="block px-4 py-2.5 rounded-lg text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 font-medium transition">
      ${mod.label}
    </a>
  `).join('');
}