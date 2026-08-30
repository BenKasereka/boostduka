import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getImportedDevis, addImportedDevis } from './importOverlay';

// =====================================================================
// Couche d'acces aux donnees.
// - Si Supabase est configure (.env), chaque table est lue via PostgREST.
// - Sinon (mode demo/portfolio), les memes tables sont lues depuis
//   public/data/*.json (genere par scripts/generate-dataset.js).
// Le reste de l'app (jointures, filtres, agregations) est ecrit une seule
// fois au-dessus de loadTable() et ne depend pas de la source.
// =====================================================================

const TABLES = [
  'provinces',
  'sections',
  'categories_articles',
  'articles',
  'section_besoins',
  'fournisseurs',
  'fournisseur_categories',
  'devis',
  'contrats_cadres',
  'commandes',
];

const cache = new Map();

async function fetchFromSupabase(table) {
  const pageSize = 1000;
  let from = 0;
  let all = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Supabase[${table}]: ${error.message}`);
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchFromLocalJson(table) {
  const res = await fetch(`/data/${table}.json`);
  if (!res.ok) throw new Error(`Impossible de charger /data/${table}.json (${res.status})`);
  return res.json();
}

export async function loadTable(table) {
  if (!TABLES.includes(table)) throw new Error(`Table inconnue: ${table}`);
  if (cache.has(table)) return cache.get(table);
  const promise = (async () => {
    const rows = isSupabaseConfigured() ? await fetchFromSupabase(table) : await fetchFromLocalJson(table);
    // Tant que Supabase n'est pas configure, les devis importes via le
    // module Import (Excel/CSV) vivent en localStorage et sont fusionnes
    // ici de facon transparente pour le reste de l'app.
    if (table === 'devis' && !isSupabaseConfigured()) {
      return rows.concat(getImportedDevis());
    }
    return rows;
  })();
  cache.set(table, promise);
  return promise;
}

// Enregistre des devis valides issus d'un import Excel/CSV (Module Import).
// Si Supabase est configure, ecrit reellement dans la table ; sinon, les
// ajoute a la surcouche locale (voir importOverlay.js).
export async function commitDevisImport(rows) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('devis').insert(rows);
    if (error) throw new Error(`Supabase[devis insert]: ${error.message}`);
  } else {
    addImportedDevis(rows);
  }
  cache.delete('devis');
}

export async function loadAllTables() {
  const entries = await Promise.all(TABLES.map(async (t) => [t, await loadTable(t)]));
  return Object.fromEntries(entries);
}

export function clearDataCache() {
  cache.clear();
}

export function dataMode() {
  return isSupabaseConfigured() ? 'supabase' : 'demo (dataset local)';
}

// ---------------------------------------------------------------------
// Helpers d'indexation
// ---------------------------------------------------------------------
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

// ---------------------------------------------------------------------
// Referentiels simples (pour peupler les filtres)
// ---------------------------------------------------------------------
export async function listProvinces() {
  return loadTable('provinces');
}

export async function listCategories() {
  return loadTable('categories_articles');
}

export async function listArticlesByCategorie(categorieId) {
  const articles = await loadTable('articles');
  if (!categorieId) return articles;
  return articles.filter((a) => a.categorie_id === categorieId);
}

export async function listSections() {
  const [sections, provinces] = await Promise.all([loadTable('sections'), loadTable('provinces')]);
  const provincesById = byId(provinces);
  return sections.map((s) => ({ ...s, province_nom: provincesById[s.province_id]?.nom_province ?? '—' }));
}

// ---------------------------------------------------------------------
// Module 1 — Liste de Prix
// Une ligne par devis, enrichie : fournisseur / province / article / categorie
// ---------------------------------------------------------------------
export async function listPriceRows(filters = {}) {
  const { provinceId, categorieId, search } = filters;
  const [devis, fournisseurs, articles, categories, provinces] = await Promise.all([
    loadTable('devis'),
    loadTable('fournisseurs'),
    loadTable('articles'),
    loadTable('categories_articles'),
    loadTable('provinces'),
  ]);

  const fournisseursById = byId(fournisseurs);
  const articlesById = byId(articles);
  const categoriesById = byId(categories);
  const provincesById = byId(provinces);

  let rows = devis.map((d) => {
    const fournisseur = fournisseursById[d.fournisseur_id];
    const article = articlesById[d.article_id];
    const categorie = article ? categoriesById[article.categorie_id] : null;
    const province = fournisseur ? provincesById[fournisseur.province_id] : null;
    return {
      devis_id: d.id,
      fournisseur_id: fournisseur?.id,
      fournisseur_nom: fournisseur?.nom ?? 'Fournisseur inconnu',
      fournisseur_statut: fournisseur?.statut,
      province_id: province?.id,
      province_nom: province?.nom_province ?? '—',
      categorie_id: categorie?.id,
      categorie_nom: categorie?.nom_categorie ?? '—',
      article_id: article?.id,
      article_nom: article?.nom_article ?? 'Article inconnu',
      unite_mesure: article?.unite_mesure,
      prix_unitaire: d.prix_unitaire,
      devise: d.devise,
      delai_livraison_jours: d.delai_livraison_jours,
      quantite_min: d.quantite_min,
      date_soumission: d.date_soumission,
      validite_offre_date: d.validite_offre_date,
    };
  });

  if (provinceId) rows = rows.filter((r) => r.province_id === provinceId);
  if (categorieId) rows = rows.filter((r) => r.categorie_id === categorieId);
  if (search) {
    const q = search.trim().toLowerCase();
    rows = rows.filter(
      (r) => r.article_nom.toLowerCase().includes(q) || r.fournisseur_nom.toLowerCase().includes(q)
    );
  }

  rows.sort((a, b) => a.article_nom.localeCompare(b.article_nom) || a.prix_unitaire - b.prix_unitaire);
  return rows;
}

// Historique de prix pour un article donne (pour un mini-graphe / tableau détail)
export async function listPriceHistoryForArticle(articleId) {
  const rows = await listPriceRows();
  return rows
    .filter((r) => r.article_id === articleId)
    .sort((a, b) => new Date(a.date_soumission) - new Date(b.date_soumission));
}

// ---------------------------------------------------------------------
// Module 3 — Synthèse comparative
// Un candidat par fournisseur ayant soumis un devis pour l'article, en
// ne retenant que le devis le plus recent si plusieurs rounds existent.
// ---------------------------------------------------------------------
export async function listCandidatesForArticle(articleId) {
  const [devis, fournisseurs, provinces] = await Promise.all([
    loadTable('devis'),
    loadTable('fournisseurs'),
    loadTable('provinces'),
  ]);

  const fournisseursById = byId(fournisseurs);
  const provincesById = byId(provinces);

  const devisArticle = devis.filter((d) => d.article_id === articleId);
  const dernierDevisParFournisseur = new Map();
  devisArticle.forEach((d) => {
    const existant = dernierDevisParFournisseur.get(d.fournisseur_id);
    if (!existant || new Date(d.date_soumission) > new Date(existant.date_soumission)) {
      dernierDevisParFournisseur.set(d.fournisseur_id, d);
    }
  });

  return Array.from(dernierDevisParFournisseur.values()).map((d) => {
    const f = fournisseursById[d.fournisseur_id];
    return {
      devis_id: d.id,
      fournisseur_id: d.fournisseur_id,
      fournisseur_nom: f?.nom ?? 'Fournisseur inconnu',
      fournisseur_statut: f?.statut,
      province_nom: provincesById[f?.province_id]?.nom_province ?? '—',
      score_fiabilite: f?.score_fiabilite ?? 0,
      conditions_paiement: f?.conditions_paiement ?? '—',
      prix_unitaire: d.prix_unitaire,
      devise: d.devise,
      delai_livraison_jours: d.delai_livraison_jours,
      quantite_min: d.quantite_min,
      validite_offre_date: d.validite_offre_date,
      date_soumission: d.date_soumission,
    };
  });
}

// ---------------------------------------------------------------------
// Module 2 — Base Fournisseurs
// ---------------------------------------------------------------------
export async function listFournisseurRows(filters = {}) {
  const { provinceId, categorieId, statut, search } = filters;
  const [fournisseurs, provinces, fournisseurCategories, categories, devis] = await Promise.all([
    loadTable('fournisseurs'),
    loadTable('provinces'),
    loadTable('fournisseur_categories'),
    loadTable('categories_articles'),
    loadTable('devis'),
  ]);

  const provincesById = byId(provinces);
  const categoriesById = byId(categories);

  const categoriesByFournisseur = {};
  fournisseurCategories.forEach((fc) => {
    (categoriesByFournisseur[fc.fournisseur_id] ||= []).push(categoriesById[fc.categorie_id]?.nom_categorie);
  });
  const categorieIdsByFournisseur = {};
  fournisseurCategories.forEach((fc) => {
    (categorieIdsByFournisseur[fc.fournisseur_id] ||= []).push(fc.categorie_id);
  });

  const nbDevisByFournisseur = {};
  devis.forEach((d) => {
    nbDevisByFournisseur[d.fournisseur_id] = (nbDevisByFournisseur[d.fournisseur_id] || 0) + 1;
  });

  let rows = fournisseurs.map((f) => ({
    ...f,
    province_nom: provincesById[f.province_id]?.nom_province ?? '—',
    categories: (categoriesByFournisseur[f.id] || []).filter(Boolean),
    categorie_ids: categorieIdsByFournisseur[f.id] || [],
    nb_devis: nbDevisByFournisseur[f.id] || 0,
  }));

  if (provinceId) rows = rows.filter((r) => r.province_id === provinceId);
  if (statut) rows = rows.filter((r) => r.statut === statut);
  if (categorieId) rows = rows.filter((r) => r.categorie_ids.includes(categorieId));
  if (search) {
    const q = search.trim().toLowerCase();
    rows = rows.filter((r) => r.nom.toLowerCase().includes(q) || r.ville?.toLowerCase().includes(q));
  }

  rows.sort((a, b) => b.score_fiabilite - a.score_fiabilite);
  return rows;
}

export async function getFournisseurDetail(fournisseurId) {
  const [rows, devis, articles, categories, contrats] = await Promise.all([
    listFournisseurRows(),
    loadTable('devis'),
    loadTable('articles'),
    loadTable('categories_articles'),
    loadTable('contrats_cadres'),
  ]);

  const fournisseur = rows.find((r) => r.id === fournisseurId);
  if (!fournisseur) return null;

  const articlesById = byId(articles);
  const categoriesById = byId(categories);

  const devisFournisseur = devis
    .filter((d) => d.fournisseur_id === fournisseurId)
    .map((d) => {
      const article = articlesById[d.article_id];
      return {
        ...d,
        article_nom: article?.nom_article ?? 'Article inconnu',
        categorie_nom: article ? categoriesById[article.categorie_id]?.nom_categorie : '—',
      };
    })
    .sort((a, b) => new Date(b.date_soumission) - new Date(a.date_soumission));

  const contratsFournisseur = contrats
    .filter((c) => c.fournisseur_id === fournisseurId)
    .map((c) => ({ ...c, categorie_nom: categoriesById[c.categorie_id]?.nom_categorie ?? '—' }));

  return { ...fournisseur, devis: devisFournisseur, contrats: contratsFournisseur };
}
