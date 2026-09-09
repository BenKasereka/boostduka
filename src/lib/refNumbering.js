// =====================================================================
// Numerotation de suivi bout-en-bout : chaque Demande Interne (IR) recoit,
// a sa finalisation, un numero de sequence unique. Ce meme numero est
// ensuite repris (prefixe different selon le document) par la RFQ, le
// dossier CBA et le Bon de Commande qui en decoulent — IR-000001 devient
// RFQ-000001, puis CBA-000001, puis PO-000001 (ou PO-000001-A/B en cas
// d'attribution scindee entre plusieurs fournisseurs). Un meme numero de
// bout en bout permet de retrouver instantanement, a partir d'une seule
// reference, tous les documents rattaches a une meme demande — et evite
// qu'un document derive se voie attribuer un identifiant sans rapport
// avec son origine.
//
// Tant que Supabase n'est pas branche, ce compteur vit en localStorage —
// suffisant pour une demo single-utilisateur ; une vraie sequence cote
// serveur (ex: sequence Postgres) serait necessaire en production
// multi-utilisateurs pour garantir l'absence de collision.
// =====================================================================

const SEQUENCE_KEY = 'visiba_ir_sequence';

export function getNextSequence() {
  let n = 0;
  try {
    n = parseInt(localStorage.getItem(SEQUENCE_KEY) || '0', 10) || 0;
  } catch {
    n = 0;
  }
  n += 1;
  try {
    localStorage.setItem(SEQUENCE_KEY, String(n));
  } catch {
    // localStorage indisponible (mode prive...) : le numero reste utilisable
    // pour ce document, simplement non garanti unique lors d'une prochaine session.
  }
  return String(n).padStart(6, '0');
}

export const refIR = (sequence) => `IR-${sequence}`;
export const refRFQ = (sequence) => `RFQ-${sequence}`;
export const refCBA = (sequence) => `CBA-${sequence}`;
export const refPO = (sequence, suffixeLettre) => `PO-${sequence}${suffixeLettre ? `-${suffixeLettre}` : ''}`;
export const refGRN = (sequence, suffixeLettre) => `GRN-${sequence}${suffixeLettre ? `-${suffixeLettre}` : ''}`;
