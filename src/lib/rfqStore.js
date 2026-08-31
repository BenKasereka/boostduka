// =====================================================================
// Persistance locale des demandes de devis (RFQ). Comme les dossiers de
// synthese comparative (localStore.js), ce module tient lieu de table
// tant que Supabase n'est pas branche en ecriture : une demande peut
// couvrir plusieurs articles et etre adressee a plusieurs fournisseurs
// (chacun recoit sa propre copie du modele Excel / document imprimable).
// =====================================================================

const STORAGE_KEY = 'visiba_demandes_devis';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listRFQs() {
  return readAll().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function getRFQ(id) {
  return readAll().find((r) => r.id === id) || null;
}

export function saveRFQ(rfq) {
  const rows = readAll();
  const idx = rows.findIndex((r) => r.id === rfq.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...rfq, updated_at: now };
  } else {
    rows.push({ ...rfq, created_at: now, updated_at: now });
  }
  writeAll(rows);
  return rfq.id;
}

export function deleteRFQ(id) {
  writeAll(readAll().filter((r) => r.id !== id));
}

export function refFromRFQId(id) {
  return `RFQ-${id.slice(0, 8).toUpperCase()}`;
}
