import { normalizeText, parseSpreadsheetFile } from './devisImport';

export { parseSpreadsheetFile };

// =====================================================================
// Parsing + validation d'un fichier Excel/CSV de fournisseurs existants
// pas encore enregistres dans la base (import en masse, en complement
// du formulaire manuel un-par-un).
// =====================================================================

const HEADER_ALIASES = {
  nom: ['nom', 'fournisseur', 'raison sociale', 'nom_fournisseur', 'name'],
  province: ['province'],
  ville: ['ville', 'localite', 'city'],
  conditions_paiement: ['conditions de paiement', 'conditions_paiement', 'modalite de paiement', 'payment terms'],
  categories: ['categories couvertes', 'categories', 'categorie', 'categorie_couverte', 'categories_couvertes'],
  email_contact: ['email contact', 'email', 'email_contact'],
  telephone_contact: ['telephone contact', 'telephone', 'telephone_contact', 'phone'],
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

export function validateFournisseurRows(rawRows, provinces, categories) {
  if (rawRows.length === 0) return [];
  const headerMap = buildHeaderMap(rawRows[0]);
  const provincesByNorm = new Map(provinces.map((p) => [normalizeText(p.nom_province), p]));
  const categoriesByNorm = new Map(categories.map((c) => [normalizeText(c.nom_categorie), c]));

  return rawRows.map((rawRow, index) => {
    const row = remapRow(rawRow, headerMap);
    const errors = [];
    const warnings = [];

    const nom = (row.nom ?? '').toString().trim();
    if (!nom) errors.push('Nom manquant');

    const provinceRaw = (row.province ?? '').toString().trim();
    const province = provinceRaw ? provincesByNorm.get(normalizeText(provinceRaw)) : undefined;
    if (!provinceRaw) errors.push('Province manquante');
    else if (!province) errors.push(`Province inconnue: "${provinceRaw}"`);

    const categoriesRaw = (row.categories ?? '').toString().trim();
    const categorieIds = [];
    if (categoriesRaw) {
      categoriesRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean).forEach((nomCat) => {
        const cat = categoriesByNorm.get(normalizeText(nomCat));
        if (cat) categorieIds.push(cat.id);
        else warnings.push(`Catégorie inconnue ignorée: "${nomCat}"`);
      });
    }

    return {
      index,
      nom,
      provinceRaw,
      province,
      ville: (row.ville ?? '').toString().trim() || null,
      conditions_paiement: (row.conditions_paiement ?? 'Net 30').toString().trim(),
      categorieIds,
      categoriesLabel: categorieIds.map((id) => categories.find((c) => c.id === id)?.nom_categorie).join(', '),
      email_contact: (row.email_contact ?? '').toString().trim() || null,
      telephone_contact: (row.telephone_contact ?? '').toString().trim() || null,
      ok: errors.length === 0,
      errors,
      warnings,
    };
  });
}

export function buildFournisseurTemplate() {
  return [
    {
      Nom: 'Kivu Trading Co',
      Province: 'Nord-Kivu',
      Ville: 'Goma',
      'Conditions de paiement': 'Net 30',
      'Catégories couvertes': 'Medical / PharMed, WASH (Eau-Hygiene-Assainissement)',
      'Email contact': 'contact@kivutrading.cd',
      'Téléphone contact': '+243812345678',
    },
  ];
}
