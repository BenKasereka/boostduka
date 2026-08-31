// =====================================================================
// Persistance locale des commandes (Bon de Commande / PO) generees depuis
// un dossier CBA valide, tant que Supabase n'est pas branche en ecriture.
// Meme principe que fournisseurStore.js/categorieStore.js : une simple
// surcouche fusionnee par dataSource.js#loadTable('commandes'). Pas de
// patch/suppression en V1 — une commande generee est un fait historique.
// =====================================================================

const NEW_KEY = 'visiba_commandes_nouvelles';

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getNewCommandes() {
  return readJson(NEW_KEY) || [];
}

export function addCommandesBulk(rows) {
  const commandes = getNewCommandes();
  commandes.push(...rows);
  localStorage.setItem(NEW_KEY, JSON.stringify(commandes));
}
