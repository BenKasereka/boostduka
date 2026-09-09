// =====================================================================
// Persistance locale des Bons de Reception (GRN - Goods Received Note) —
// meme principe que les autres surcouches (localStore.js, rfqStore.js,
// prStore.js) : un GRN est genere une fois par PO receptionne (module
// Reception), document imprimable pour signature/archivage, et porte la
// reference du PO d'origine pour rester tracable jusqu'a l'IR de depart.
// =====================================================================

import { refGRN } from './refNumbering';

const STORAGE_KEY = 'visiba_bons_reception';

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

export function listGRNs() {
  return readAll().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function getGRN(id) {
  return readAll().find((g) => g.id === id) || null;
}

export function saveGRN(grn) {
  const rows = readAll();
  rows.push({ ...grn, created_at: new Date().toISOString() });
  writeAll(rows);
  return grn.id;
}

// Reference bout-en-bout : reprend la sequence + suffixe (attribution
// scindee) du PO reçu — sinon repli sur une reference derivee de l'id.
export function refFromGRN(grn) {
  return grn?.sequence ? refGRN(grn.sequence, grn.suffixe_lettre) : `GRN-${grn.id.slice(0, 8).toUpperCase()}`;
}
