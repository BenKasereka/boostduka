// =====================================================================
// Persistance locale des commandes (Bon de Commande / PO), tant que
// Supabase n'est pas branche en ecriture. Meme principe que
// fournisseurStore.js/categorieStore.js : une simple surcouche fusionnee
// par dataSource.js#loadTable('commandes').
//  - "nouvelles" : commandes generees depuis un dossier CBA valide
//  - "patches"   : mise a jour d'une commande existante (module Reception —
//    date de livraison reelle, statut, ecart) — s'applique aussi bien aux
//    commandes generees localement qu'a celles du dataset de base.
// =====================================================================

const NEW_KEY = 'visiba_commandes_nouvelles';
const PATCHES_KEY = 'visiba_commandes_patches';

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

export function getCommandePatches() {
  return readJson(PATCHES_KEY) || {};
}

export function patchCommande(commandeId, patch) {
  const patches = getCommandePatches();
  patches[commandeId] = { ...(patches[commandeId] || {}), ...patch };
  localStorage.setItem(PATCHES_KEY, JSON.stringify(patches));
}
