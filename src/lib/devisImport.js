// =====================================================================
// Parsing + validation d'un fichier Excel/CSV de devis fournisseur.
// En-tetes flexibles (accents/majuscules/variantes anglaises tolerees),
// mais chaque "Article" doit correspondre a un article du catalogue
// existant (matching normalise) : le module n'invente pas de nouvelles
// lignes de catalogue a la volee, pour ne pas casser le modele relationnel.
// =====================================================================

import { CURRENCIES, toUsd } from './currency';

const CODES_DEVISE_VALIDES = CURRENCIES.map((c) => c.code);

const HEADER_ALIASES = {
  article: ['article', 'nom_article', 'produit', 'item', 'designation'],
  prix_unitaire: ['prix unitaire', 'prix_unitaire', 'prix', 'unit price', 'price'],
  devise: ['devise', 'currency'],
  delai_livraison_jours: [
    'delai livraison (jours)', 'delai_livraison_jours', 'delai', 'delai livraison',
    'lead time', 'lead time (days)', 'lead time (jours)',
  ],
  quantite_min: ['quantite min', 'quantite_min', 'qte min', 'min order qty', 'moq'],
  validite_offre_date: ['validite offre', 'validite_offre_date', 'date validite offre', 'valid until', 'validite'],
};

export function normalizeText(s) {
  return s
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export async function parseSpreadsheetFile(file) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

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

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function validateImportRows(rawRows, articles) {
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

    const prixUnitaire = Number(row.prix_unitaire);
    if (row.prix_unitaire === undefined || row.prix_unitaire === '' || isNaN(prixUnitaire) || prixUnitaire <= 0) {
      errors.push('Prix unitaire invalide');
    }

    let devise = (row.devise ?? 'USD').toString().trim().toUpperCase();
    if (!CODES_DEVISE_VALIDES.includes(devise)) devise = 'USD';

    const delai = Number(row.delai_livraison_jours);
    const delaiValide = row.delai_livraison_jours !== undefined && row.delai_livraison_jours !== '' && !isNaN(delai) && delai >= 0;
    if (!delaiValide) errors.push('Délai de livraison invalide');

    let quantiteMin = Number(row.quantite_min);
    if (!quantiteMin || quantiteMin < 1) quantiteMin = 1;

    return {
      index,
      articleRaw,
      article,
      prix_unitaire: prixUnitaire,
      devise,
      prix_unitaire_usd: isNaN(prixUnitaire) ? null : toUsd(prixUnitaire, devise),
      delai_livraison_jours: delaiValide ? delai : null,
      quantite_min: quantiteMin,
      validite_offre_date: parseDate(row.validite_offre_date),
      ligneSource: rawRow._ligneSource,
      ok: errors.length === 0,
      errors,
    };
  });
}

export function buildDevisTemplate() {
  return [
    {
      Article: 'Gants latex examen (boite 100)',
      'Prix unitaire': 12.5,
      Devise: 'USD',
      'Délai livraison (jours)': 7,
      'Quantité min': 10,
      'Validité offre': '2026-12-31',
    },
  ];
}
