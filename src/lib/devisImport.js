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
  quantite_reference: ['qte', 'quantite', 'quantite reference', 'quantite_reference', 'qty', 'quantity'],
  delai_livraison_jours: [
    'delai livraison (jours)', 'delai_livraison_jours', 'delai', 'delai livraison',
    'lead time', 'lead time (days)', 'lead time (jours)',
  ],
  transport_inclus: ['transport inclus', 'transport_inclus', 'transport compris', 'freight included'],
  // "quantite_min"/"moq" sont les anciens intitules de ce champ ; conserves
  // en alias pour la compatibilite avec d'anciens fichiers deja remplis.
  stock_disponible: [
    'qte min-stock', 'qte min stock', 'stock disponible', 'stock_disponible',
    'quantite min-stock', 'quantite_min', 'qte min', 'min order qty', 'moq',
  ],
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
  const estTexte = /\.(csv|txt)$/i.test(file.name);
  let workbook;
  if (estTexte) {
    // Les fichiers texte (CSV) doivent etre decodes explicitement en UTF-8 :
    // laisser XLSX deviner l'encodage a partir d'octets bruts corrompt les
    // en-tetes accentues ("Délai", "Qté") sans erreur visible.
    const texte = new TextDecoder('utf-8').decode(await file.arrayBuffer());
    workbook = XLSX.read(texte, { type: 'string', cellDates: true });
  } else {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  }
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

function parseBoolean(value) {
  const s = (value ?? '').toString().trim().toLowerCase();
  return ['oui', 'yes', 'true', '1', 'vrai'].includes(s);
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

    let quantiteReference = Number(row.quantite_reference);
    if (!quantiteReference || quantiteReference < 1) quantiteReference = 1;

    // null = non renseigne (ex: non detecte dans un PDF) plutot que 0, pour
    // ne pas afficher a tort une "rupture de stock" non confirmee.
    let stockDisponible = row.stock_disponible === undefined || row.stock_disponible === '' ? null : Number(row.stock_disponible);
    if (stockDisponible !== null && (isNaN(stockDisponible) || stockDisponible < 0)) stockDisponible = null;

    return {
      index,
      articleRaw,
      article,
      prix_unitaire: prixUnitaire,
      devise,
      prix_unitaire_usd: isNaN(prixUnitaire) ? null : toUsd(prixUnitaire, devise),
      quantite_reference: quantiteReference,
      delai_livraison_jours: delaiValide ? delai : null,
      transport_inclus: parseBoolean(row.transport_inclus),
      stock_disponible: stockDisponible,
      validite_offre_date: parseDate(row.validite_offre_date),
      ligneSource: rawRow._ligneSource,
      ok: errors.length === 0,
      errors,
    };
  });
}

// Reevalue une ligne apres une correction manuelle dans l'apercu (ImportDevis.jsx) :
// memes regles que validateImportRows, mais appliquees directement sur les
// champs deja types de la ligne plutot que sur un texte brut d'en-tete.
export function revalidateRow(row) {
  const errors = [];
  if (!row.article) errors.push(row.articleRaw ? 'Article inconnu du catalogue' : 'Article manquant');
  const prix = Number(row.prix_unitaire);
  if (row.prix_unitaire === undefined || row.prix_unitaire === null || row.prix_unitaire === '' || isNaN(prix) || prix <= 0) {
    errors.push('Prix unitaire invalide');
  }
  const delai = Number(row.delai_livraison_jours);
  if (row.delai_livraison_jours === undefined || row.delai_livraison_jours === null || row.delai_livraison_jours === '' || isNaN(delai) || delai < 0) {
    errors.push('Délai de livraison invalide');
  }
  return { ...row, ok: errors.length === 0, errors };
}

export function buildDevisTemplate() {
  return [
    {
      Article: 'Gants latex examen (boite 100)',
      Qté: 10,
      'Prix unitaire': 12.5,
      Devise: 'USD',
      'Délai livraison (jours)': 7,
      'Transport inclus': 'Non',
      'Qté Min-Stock': 200,
      'Validité offre': '2026-12-31',
    },
  ];
}
