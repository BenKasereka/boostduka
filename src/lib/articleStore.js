// =====================================================================
// Persistance locale pour la gestion du catalogue d'articles tant que
// Supabase n'est pas branche en ecriture. Meme logique que
// categorieStore.js / fournisseurStore.js : nouveaux articles, patches
// (renommage/unite/description), suppressions (bloquees si des devis,
// commandes ou lignes d'evaluation y font encore reference).
// =====================================================================

const NEW_KEY = 'visiba_articles_nouveaux';
const PATCHES_KEY = 'visiba_articles_patches';
const DELETED_KEY = 'visiba_articles_supprimes';

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getNewArticles() {
  return readJson(NEW_KEY) || [];
}

export function addArticle(article) {
  const articles = getNewArticles();
  articles.push(article);
  localStorage.setItem(NEW_KEY, JSON.stringify(articles));
}

export function getArticlePatches() {
  return readJson(PATCHES_KEY) || {};
}

export function patchArticle(articleId, patch) {
  const patches = getArticlePatches();
  patches[articleId] = { ...(patches[articleId] || {}), ...patch };
  localStorage.setItem(PATCHES_KEY, JSON.stringify(patches));
}

export function getDeletedArticleIds() {
  return readJson(DELETED_KEY) || [];
}

export function markArticleDeleted(articleId) {
  const ids = getDeletedArticleIds();
  if (!ids.includes(articleId)) {
    ids.push(articleId);
    localStorage.setItem(DELETED_KEY, JSON.stringify(ids));
  }
}
