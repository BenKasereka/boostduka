// =====================================================================
// Persistance locale pour la gestion fournisseurs tant que Supabase n'est
// pas branche en ecriture :
//  - nouveaux fournisseurs enregistres (table fournisseurs + jointure
//    fournisseur_categories)
//  - "patches" (statut, score_fiabilite, conditions_paiement...) appliques
//    a N'IMPORTE QUEL fournisseur, y compris ceux du dataset de base —
//    cela sert de suppression "douce" (passage en suspendu/blackliste)
//    quand un fournisseur a deja un historique (devis/commandes/contrats)
//  - suppression definitive (uniquement autorisee par dataSource.js quand
//    aucun historique n'existe pour ce fournisseur)
// =====================================================================

const NEW_KEY = 'visiba_fournisseurs_nouveaux';
const NEW_CATS_KEY = 'visiba_fournisseur_categories_nouveaux';
const PATCHES_KEY = 'visiba_fournisseurs_patches';
const DELETED_KEY = 'visiba_fournisseurs_supprimes';

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getNewFournisseurs() {
  return readJson(NEW_KEY) || [];
}

export function getNewFournisseurCategories() {
  return readJson(NEW_CATS_KEY) || [];
}

export function getFournisseurPatches() {
  return readJson(PATCHES_KEY) || {};
}

export function addFournisseur(fournisseur, categorieIds) {
  addFournisseursBulk([{ fournisseur, categorieIds }]);
}

// Enregistre plusieurs fournisseurs en une seule fois (import Excel/CSV en masse).
export function addFournisseursBulk(items) {
  const fournisseurs = getNewFournisseurs();
  const cats = getNewFournisseurCategories();

  items.forEach(({ fournisseur, categorieIds }) => {
    fournisseurs.push(fournisseur);
    categorieIds.forEach((categorie_id) => {
      cats.push({ fournisseur_id: fournisseur.id, categorie_id });
    });
  });

  localStorage.setItem(NEW_KEY, JSON.stringify(fournisseurs));
  localStorage.setItem(NEW_CATS_KEY, JSON.stringify(cats));
}

export function patchFournisseur(fournisseurId, patch) {
  const patches = getFournisseurPatches();
  patches[fournisseurId] = { ...(patches[fournisseurId] || {}), ...patch };
  localStorage.setItem(PATCHES_KEY, JSON.stringify(patches));
}

export function getDeletedFournisseurIds() {
  return readJson(DELETED_KEY) || [];
}

export function markFournisseurDeleted(fournisseurId) {
  const ids = getDeletedFournisseurIds();
  if (!ids.includes(fournisseurId)) {
    ids.push(fournisseurId);
    localStorage.setItem(DELETED_KEY, JSON.stringify(ids));
  }
}
