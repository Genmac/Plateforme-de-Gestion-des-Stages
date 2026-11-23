import { session } from './session.js';

export async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const token = session.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // Envoi de l'en-tête de développement si aucun JWT n'est présent
    headers['x-dev-user'] = session.getDevUser();
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.error?.message || 'Erreur lors de la communication avec le serveur');
  }

  return data;
}