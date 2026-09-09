// =====================================================================
// Parsing + validation d'un fichier Excel/CSV d'encodage rapide d'une
// demande interne (PR) — meme logique que devisImport.js (en-tetes
// flexibles, "Article" doit correspondre au catalogue existant), mais
// pour une liste d'articles demandes en interne plutot qu'une quotation
// fournisseur : pas de prix/devise/delai, seulement Article + Quantite.
// =====================================================================

import { normalizeText } from './devisImport';

const HEADER_ALIASES = {
  article: ['article', 'nom_article', 'produit', 'item', 'designation'],
  quantite: ['qte', 'quantite', 'quantite demandee', 'quantite_demandee', 'qty', 'quantity'],
  commentaire: ['commentaire', 'justification', 'note', 'comment', 'remarque'],
};

function buildHeaderMap(rawRow) {
  const map = {};
  Object.keys(rawRow).forEach((key) => {
    const norm = normalizeText(key);
    const canon = Object.entries(HEADER_ALIASES).find(([, aliases]) => aliases.includes(norm))?.[0];
    if (canon) map[key] = canon;
  });
  return map;
}

function remapRow(rawRow, headerMap) {
  const out = {};
  Object.entries(rawRow).forEach(([k, v]) => {
    const canon = headerMap[k];
    if (canon) out[canon] = v;
  });
  return out;
}

export function validatePRImportRows(rawRows, articles) {
  if (rawRows.length === 0) return [];
  const headerMap = buildHeaderMap(rawRows[0]);
  const articlesByNormName = new Map(articles.map((a) => [normalizeText(a.nom_article), a]));

  return rawRows.map((rawRow, index) => {
    const row = remapRow(rawRow, headerMap);
    const errors = [];

    const articleRaw = (row.article ?? '').toString().trim();
    if (!articleRaw) errors.push('Article manquant');
    const article = articleRaw ? articlesByNormName.get(normalizeText(articleRaw)) : undefined;
    if (articleRaw && !article) errors.push('Article inconnu du catalogue');

    let quantite = Number(row.quantite);
    if (row.quantite === undefined || row.quantite === '' || isNaN(quantite) || quantite < 1) {
      errors.push('Quantité invalide');
      quantite = isNaN(quantite) || quantite < 1 ? 1 : quantite;
    }

    return {
      index,
      articleRaw,
      article,
      quantite,
      commentaire: (row.commentaire ?? '').toString().trim(),
      ok: errors.length === 0,
      errors,
    };
  });
}

// Reevalue une ligne apres une correction manuelle dans l'apercu editable.
export function revalidatePRRow(row) {
  const errors = [];
  if (!row.article) errors.push(row.articleRaw ? 'Article inconnu du catalogue' : 'Article manquant');
  const q = Number(row.quantite);
  if (row.quantite === undefined || row.quantite === null || row.quantite === '' || isNaN(q) || q < 1) {
    errors.push('Quantité invalide');
  }
  return { ...row, ok: errors.length === 0, errors };
}

export function buildPRTemplate() {
  return [
    { Article: 'Gants latex examen (boite 100)', Qté: 20, Commentaire: 'ex: stock hebdomadaire base Goma' },
  ];
}
