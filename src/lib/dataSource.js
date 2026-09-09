import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getImportedDevis, addImportedDevis } from './importOverlay';
import { toUsd } from './currency';
import {
  getNewFournisseurs,
  getNewFournisseurCategories,
  getFournisseurPatches,
  addFournisseur,
  addFournisseursBulk,
  patchFournisseur,
  getDeletedFournisseurIds,
  markFournisseurDeleted,
} from './fournisseurStore';
import {
  getNewCategories,
  addCategorie,
  getCategoriePatches,
  patchCategorie,
  getDeletedCategorieIds,
  markCategorieDeleted,
} from './categorieStore';
import {
  getNewArticles,
  addArticle,
  getArticlePatches,
  patchArticle,
  getDeletedArticleIds,
  markArticleDeleted,
} from './articleStore';
import { listEvaluations } from './localStore';
import { getNewCommandes, addCommandesBulk, getCommandePatches, patchCommande } from './commandeStore';

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
    if (table === 'fournisseurs' && !isSupabaseConfigured()) {
      const patches = getFournisseurPatches();
      const applyPatch = (f) => (patches[f.id] ? { ...f, ...patches[f.id] } : f);
      const deleted = new Set(getDeletedFournisseurIds());
      return rows.concat(getNewFournisseurs()).filter((f) => !deleted.has(f.id)).map(applyPatch);
    }
    if (table === 'fournisseur_categories' && !isSupabaseConfigured()) {
      const deleted = new Set(getDeletedFournisseurIds());
      return rows.concat(getNewFournisseurCategories()).filter((fc) => !deleted.has(fc.fournisseur_id));
    }
    if (table === 'categories_articles' && !isSupabaseConfigured()) {
      const patches = getCategoriePatches();
      const applyPatch = (c) => (patches[c.id] ? { ...c, ...patches[c.id] } : c);
      const deleted = new Set(getDeletedCategorieIds());
      return rows.concat(getNewCategories()).filter((c) => !deleted.has(c.id)).map(applyPatch);
    }
    if (table === 'articles' && !isSupabaseConfigured()) {
      const patches = getArticlePatches();
      const applyPatch = (a) => (patches[a.id] ? { ...a, ...patches[a.id] } : a);
      const deleted = new Set(getDeletedArticleIds());
      return rows.concat(getNewArticles()).filter((a) => !deleted.has(a.id)).map(applyPatch);
    }
    if (table === 'commandes' && !isSupabaseConfigured()) {
      const patches = getCommandePatches();
      const applyPatch = (c) => (patches[c.id] ? { ...c, ...patches[c.id] } : c);
      return rows.concat(getNewCommandes()).map(applyPatch);
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

// Enregistre un nouveau fournisseur (fiche + categories couvertes).
export async function commitNouveauFournisseur(fournisseur, categorieIds) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('fournisseurs').insert([fournisseur]);
    if (error) throw new Error(`Supabase[fournisseurs insert]: ${error.message}`);
    if (categorieIds.length > 0) {
      const { error: errCat } = await supabase
        .from('fournisseur_categories')
        .insert(categorieIds.map((categorie_id) => ({ fournisseur_id: fournisseur.id, categorie_id })));
      if (errCat) throw new Error(`Supabase[fournisseur_categories insert]: ${errCat.message}`);
    }
  } else {
    addFournisseur(fournisseur, categorieIds);
  }
  cache.delete('fournisseurs');
  cache.delete('fournisseur_categories');
}

// Enregistre plusieurs nouveaux fournisseurs en une fois (import Excel/CSV en masse).
// items: [{ fournisseur, categorieIds }]
export async function commitNouveauxFournisseurs(items) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('fournisseurs').insert(items.map((i) => i.fournisseur));
    if (error) throw new Error(`Supabase[fournisseurs insert]: ${error.message}`);
    const liens = items.flatMap((i) => i.categorieIds.map((categorie_id) => ({ fournisseur_id: i.fournisseur.id, categorie_id })));
    if (liens.length > 0) {
      const { error: errCat } = await supabase.from('fournisseur_categories').insert(liens);
      if (errCat) throw new Error(`Supabase[fournisseur_categories insert]: ${errCat.message}`);
    }
  } else {
    addFournisseursBulk(items);
  }
  cache.delete('fournisseurs');
  cache.delete('fournisseur_categories');
}

// Modifie un fournisseur existant (statut, score de fiabilite, conditions...).
// Sert notamment de "suppression douce" (passage en suspendu/blackliste)
// plutot qu'une suppression definitive qui casserait l'historique des
// devis/commandes deja rattaches a ce fournisseur.
export async function commitFournisseurPatch(fournisseurId, patch) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('fournisseurs').update(patch).eq('id', fournisseurId);
    if (error) throw new Error(`Supabase[fournisseurs update]: ${error.message}`);
  } else {
    patchFournisseur(fournisseurId, patch);
  }
  cache.delete('fournisseurs');
}

// Compte l'historique d'un fournisseur (devis/commandes/contrats-cadres) —
// sert a decider si une suppression definitive est possible sans casser
// l'integrite referentielle de l'application.
export async function getFournisseurHistoryCounts(fournisseurId) {
  const [devis, commandes, contrats] = await Promise.all([
    loadTable('devis'),
    loadTable('commandes'),
    loadTable('contrats_cadres'),
  ]);
  return {
    devis: devis.filter((d) => d.fournisseur_id === fournisseurId).length,
    commandes: commandes.filter((c) => c.fournisseur_id === fournisseurId).length,
    contrats: contrats.filter((c) => c.fournisseur_id === fournisseurId).length,
  };
}

// Supprime definitivement un fournisseur — refuse s'il a le moindre
// historique (devis/commandes/contrats-cadres), pour ne jamais casser une
// reference existante ailleurs dans l'application. Dans ce cas, invite a
// utiliser le statut "blackliste"/"suspendu" a la place (voir
// commitFournisseurPatch), qui prevoit exactement ce cas.
export async function commitSupprimerFournisseur(fournisseurId) {
  const counts = await getFournisseurHistoryCounts(fournisseurId);
  const total = counts.devis + counts.commandes + counts.contrats;
  if (total > 0) {
    const err = new Error(
      `Suppression impossible : ce fournisseur a un historique (${counts.devis} devis, ${counts.commandes} commande(s), ${counts.contrats} contrat(s)-cadre). ` +
      'Utilisez le statut "suspendu" ou "blackliste" pour l\'exclure sans casser cet historique.'
    );
    err.code = 'HAS_HISTORY';
    throw err;
  }
  if (isSupabaseConfigured()) {
    await supabase.from('fournisseur_categories').delete().eq('fournisseur_id', fournisseurId);
    const { error } = await supabase.from('fournisseurs').delete().eq('id', fournisseurId);
    if (error) throw new Error(`Supabase[fournisseurs delete]: ${error.message}`);
  } else {
    markFournisseurDeleted(fournisseurId);
  }
  cache.delete('fournisseurs');
  cache.delete('fournisseur_categories');
}

// ---------------------------------------------------------------------
// Module Configuration — gestion des catégories d'achats
// ---------------------------------------------------------------------
export async function commitNouvelleCategorie(nomCategorie, description) {
  const categories = await loadTable('categories_articles');
  const maxId = categories.reduce((m, c) => Math.max(m, c.id), 0);
  const categorie = { id: maxId + 1, nom_categorie: nomCategorie, description: description || null };
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('categories_articles').insert([categorie]);
    if (error) throw new Error(`Supabase[categories_articles insert]: ${error.message}`);
  } else {
    addCategorie(categorie);
  }
  cache.delete('categories_articles');
  return categorie;
}

export async function commitCategoriePatch(categorieId, patch) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('categories_articles').update(patch).eq('id', categorieId);
    if (error) throw new Error(`Supabase[categories_articles update]: ${error.message}`);
  } else {
    patchCategorie(categorieId, patch);
  }
  cache.delete('categories_articles');
}

// Compte les references a une categorie (articles du catalogue, fournisseurs
// qui la couvrent, besoins de section, contrats-cadres) — sert a decider si
// une suppression est possible sans casser l'integrite referentielle.
export async function getCategorieHistoryCounts(categorieId) {
  const [articles, fournisseurCategories, sectionBesoins, contrats] = await Promise.all([
    loadTable('articles'),
    loadTable('fournisseur_categories'),
    loadTable('section_besoins'),
    loadTable('contrats_cadres'),
  ]);
  return {
    articles: articles.filter((a) => a.categorie_id === categorieId).length,
    fournisseurs: fournisseurCategories.filter((fc) => fc.categorie_id === categorieId).length,
    besoins: sectionBesoins.filter((sb) => sb.categorie_id === categorieId).length,
    contrats: contrats.filter((c) => c.categorie_id === categorieId).length,
  };
}

export async function commitSupprimerCategorie(categorieId) {
  const counts = await getCategorieHistoryCounts(categorieId);
  const total = counts.articles + counts.fournisseurs + counts.besoins + counts.contrats;
  if (total > 0) {
    const err = new Error(
      `Suppression impossible : ${counts.articles} article(s) du catalogue, ${counts.fournisseurs} lien(s) fournisseur, ` +
      `${counts.besoins} besoin(s) de section et ${counts.contrats} contrat(s)-cadre référencent encore cette catégorie. ` +
      'Réaffectez ou supprimez ces éléments avant de supprimer la catégorie.'
    );
    err.code = 'HAS_HISTORY';
    throw err;
  }
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('categories_articles').delete().eq('id', categorieId);
    if (error) throw new Error(`Supabase[categories_articles delete]: ${error.message}`);
  } else {
    markCategorieDeleted(categorieId);
  }
  cache.delete('categories_articles');
}

// ---------------------------------------------------------------------
// Module Configuration — gestion du catalogue d'articles
// ---------------------------------------------------------------------
export async function commitNouvelArticle(categorieId, nomArticle, uniteMesure, descriptionSpecification) {
  const articles = await loadTable('articles');
  const maxId = articles.reduce((m, a) => Math.max(m, a.id), 0);
  const article = {
    id: maxId + 1,
    categorie_id: categorieId,
    nom_article: nomArticle,
    unite_mesure: uniteMesure,
    description_specification: descriptionSpecification || null,
  };
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('articles').insert([article]);
    if (error) throw new Error(`Supabase[articles insert]: ${error.message}`);
  } else {
    addArticle(article);
  }
  cache.delete('articles');
  return article;
}

export async function commitArticlePatch(articleId, patch) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('articles').update(patch).eq('id', articleId);
    if (error) throw new Error(`Supabase[articles update]: ${error.message}`);
  } else {
    patchArticle(articleId, patch);
  }
  cache.delete('articles');
}

// Compte les references a un article (devis, commandes, lignes d'evaluation
// de synthese comparative) — sert a decider si une suppression est possible.
export async function getArticleHistoryCounts(articleId) {
  const [devis, commandes] = await Promise.all([loadTable('devis'), loadTable('commandes')]);
  const evaluations = listEvaluations();
  const evaluationLignes = evaluations.reduce(
    (n, ev) => n + (ev.articles || []).filter((a) => a.article_id === articleId).length,
    0
  );
  return {
    devis: devis.filter((d) => d.article_id === articleId).length,
    commandes: commandes.filter((c) => c.article_id === articleId).length,
    evaluations: evaluationLignes,
  };
}

export async function commitSupprimerArticle(articleId) {
  const counts = await getArticleHistoryCounts(articleId);
  const total = counts.devis + counts.commandes + counts.evaluations;
  if (total > 0) {
    const err = new Error(
      `Suppression impossible : ${counts.devis} devis, ${counts.commandes} commande(s) et ${counts.evaluations} ` +
      'synthèse(s) comparative(s) référencent encore cet article. Supprimez ou réaffectez ces éléments d\'abord.'
    );
    err.code = 'HAS_HISTORY';
    throw err;
  }
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('articles').delete().eq('id', articleId);
    if (error) throw new Error(`Supabase[articles delete]: ${error.message}`);
  } else {
    markArticleDeleted(articleId);
  }
  cache.delete('articles');
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
      description_specification: article?.description_specification,
      prix_unitaire: d.prix_unitaire,
      devise: d.devise,
      quantite_reference: d.quantite_reference,
      delai_livraison_jours: d.delai_livraison_jours,
      transport_inclus: d.transport_inclus,
      stock_disponible: d.stock_disponible,
      date_soumission: d.date_soumission,
      validite_offre_date: d.validite_offre_date,
      conditions_paiement: fournisseur?.conditions_paiement ?? '—',
      prix_unitaire_usd: toUsd(d.prix_unitaire, d.devise),
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

  // Tri sur l'equivalent USD : comparer des prix bruts entre devises
  // differentes (CDF vs USD) n'aurait aucun sens.
  rows.sort((a, b) => a.article_nom.localeCompare(b.article_nom) || a.prix_unitaire_usd - b.prix_unitaire_usd);
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
      prix_unitaire_usd: toUsd(d.prix_unitaire, d.devise),
      quantite_reference: d.quantite_reference,
      delai_livraison_jours: d.delai_livraison_jours,
      transport_inclus: d.transport_inclus,
      stock_disponible: d.stock_disponible,
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

// ---------------------------------------------------------------------
// Module Bon de Commande (PO) — genere le PR->PO a partir d'un dossier
// CBA valide. Une commande par ligne d'article/fournisseur retenu.
// ---------------------------------------------------------------------
export async function commitCreerCommandes(rows) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('commandes').insert(rows);
    if (error) throw new Error(`Supabase[commandes insert]: ${error.message}`);
  } else {
    addCommandesBulk(rows);
  }
  cache.delete('commandes');
}

// ---------------------------------------------------------------------
// Module Réception — dernière étape du cycle (PR -> RFQ -> ... -> PO ->
// Réception) : confirme la livraison réelle d'une commande, ce qui met
// à jour en direct les KPIs Livraison du Dashboard (lead time, taux à
// temps, annulations).
// ---------------------------------------------------------------------
async function enrichCommandes(commandes) {
  const [fournisseurs, articles, sections] = await Promise.all([
    loadTable('fournisseurs'),
    loadTable('articles'),
    loadTable('sections'),
  ]);
  const fournisseursById = byId(fournisseurs);
  const articlesById = byId(articles);
  const sectionsById = byId(sections);
  return commandes.map((c) => ({
    ...c,
    fournisseur_nom: fournisseursById[c.fournisseur_id]?.nom ?? 'Fournisseur inconnu',
    article_nom: articlesById[c.article_id]?.nom_article ?? 'Article inconnu',
    section_nom: sectionsById[c.section_id]?.nom_base ?? '—',
  }));
}

// Commandes en attente de réception (statut toujours 'en_cours'), triées
// par date de livraison prévue — les plus urgentes/en retard en premier.
export async function listCommandesEnAttente() {
  const commandes = await loadTable('commandes');
  const enrichies = await enrichCommandes(commandes.filter((c) => c.statut === 'en_cours'));
  return enrichies.sort((a, b) => new Date(a.date_livraison_prevue || a.date_po) - new Date(b.date_livraison_prevue || b.date_po));
}

// Historique complet des réceptions déjà traitées (les plus récentes en
// premier) — pas de troncature ici : c'est à l'appelant de limiter l'affichage
// s'il le souhaite, pour ne pas fausser un compteur sur le total réel.
export async function listCommandesRecues() {
  const commandes = await loadTable('commandes');
  const enrichies = await enrichCommandes(commandes.filter((c) => c.statut !== 'en_cours'));
  return enrichies.sort((a, b) => new Date(b.date_livraison_reelle || b.date_po) - new Date(a.date_livraison_reelle || a.date_po));
}

// Confirme la réception d'une commande : enregistre la date réelle de
// livraison et deduit le statut (à temps / en retard) a partir de l'écart
// avec la date prévue — ou marque la commande comme annulée si elle ne
// sera finalement jamais livrée.
export async function commitReceptionCommande(commandeId, patch) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('commandes').update(patch).eq('id', commandeId);
    if (error) throw new Error(`Supabase[commandes update]: ${error.message}`);
  } else {
    patchCommande(commandeId, patch);
  }
  cache.delete('commandes');
}
