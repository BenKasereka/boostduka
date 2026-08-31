// =====================================================================
// Persistance locale pour la gestion des categories d'achats tant que
// Supabase n'est pas branche en ecriture. Meme logique que fournisseurStore.js :
// nouvelles categories, patches (renommage/description), suppressions
// (bloquees si des articles/fournisseurs/besoins/contrats y font encore
// reference — voir getCategorieHistoryCounts dans dataSource.js).
// =====================================================================

const NEW_KEY = 'visiba_categories_nouvelles';
const PATCHES_KEY = 'visiba_categories_patches';
const DELETED_KEY = 'visiba_categories_supprimees';

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getNewCategories() {
  return readJson(NEW_KEY) || [];
}

export function addCategorie(categorie) {
  const categories = getNewCategories();
  categories.push(categorie);
  localStorage.setItem(NEW_KEY, JSON.stringify(categories));
}

export function getCategoriePatches() {
  return readJson(PATCHES_KEY) || {};
}

export function patchCategorie(categorieId, patch) {
  const patches = getCategoriePatches();
  patches[categorieId] = { ...(patches[categorieId] || {}), ...patch };
  localStorage.setItem(PATCHES_KEY, JSON.stringify(patches));
}

export function getDeletedCategorieIds() {
  return readJson(DELETED_KEY) || [];
}

export function markCategorieDeleted(categorieId) {
  const ids = getDeletedCategorieIds();
  if (!ids.includes(categorieId)) {
    ids.push(categorieId);
    localStorage.setItem(DELETED_KEY, JSON.stringify(ids));
  }
}
