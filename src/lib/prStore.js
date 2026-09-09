// =====================================================================
// Persistance locale des demandes internes (Purchase Requisition / PR) —
// meme principe que localStore.js (evaluations) et rfqStore.js (RFQ) :
// tant que Supabase n'est pas branche en ecriture, une simple surcouche
// localStorage. Une demande interne est le point de depart du cycle
// procurement (Needs Assessment) : une fois finalisee, elle sert de base
// pour generer une Demande de devis (RFQ) adressee aux fournisseurs.
// =====================================================================

import { getNextSequence, refIR } from './refNumbering';

const STORAGE_KEY = 'visiba_demandes_internes';
const PENDING_RFQ_KEY = 'visiba_pr_en_attente_rfq';

export { getNextSequence };

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

export function listPRs() {
  return readAll().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function getPR(id) {
  return readAll().find((p) => p.id === id) || null;
}

export function savePR(pr) {
  const rows = readAll();
  const idx = rows.findIndex((p) => p.id === pr.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...pr, updated_at: now };
  } else {
    rows.push({ ...pr, created_at: now, updated_at: now });
  }
  writeAll(rows);
  return pr.id;
}

export function deletePR(id) {
  writeAll(readAll().filter((p) => p.id !== id));
}

export function refFromPRId(id) {
  return `PR-${id.slice(0, 8).toUpperCase()}`;
}

// Reference de suivi bout-en-bout (IR-000001...) — presente sur toute
// demande finalisee depuis l'ajout de la numerotation sequentielle.
// Repli sur l'ancienne reference derivee de l'id pour les demandes
// enregistrees avant ce changement (pas de "sequence" stockee).
export function refFromPR(pr) {
  return pr?.sequence ? refIR(pr.sequence) : refFromPRId(pr.id);
}

// Pont PR -> RFQ : la demande interne finalisee "attend" d'etre transformee
// en Demande de devis. DemandeDevis.jsx consomme (lit puis efface) ce
// marqueur au montage pour pre-remplir sa liste d'articles, sans routeur
// URL ni prop-drilling entre les deux pages.
export function markPRPourRFQ(prId) {
  localStorage.setItem(PENDING_RFQ_KEY, prId);
}

export function consumePRPourRFQ() {
  const id = localStorage.getItem(PENDING_RFQ_KEY);
  if (id) localStorage.removeItem(PENDING_RFQ_KEY);
  return id;
}
