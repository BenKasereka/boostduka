// =====================================================================
// Surcouche locale pour les devis importés tant que Supabase n'est pas
// branché en écriture : les lignes valides d'un import Excel/CSV sont
// ajoutées ici et fusionnées par dataSource.loadTable('devis') avec le
// dataset de base, pour que Liste de Prix / Synthèse comparative /
// Dashboard les reflètent immédiatement.
// =====================================================================

const STORAGE_KEY = 'visiba_devis_import_overlay';

export function getImportedDevis() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addImportedDevis(rows) {
  const existing = getImportedDevis();
  const merged = existing.concat(rows);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

export function clearImportedDevis() {
  localStorage.removeItem(STORAGE_KEY);
}
