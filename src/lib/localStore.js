// =====================================================================
// Persistance locale (navigateur) des dossiers de synthese comparative.
// Tant que Supabase n'est pas branche, cette couche tient lieu d'insert/
// update sur evaluations_comparatives + evaluation_articles + evaluation_
// lignes + evaluation_criteres_personnalises (voir schema.sql). Un dossier
// peut couvrir plusieurs articles (un "lot"), chacun avec son propre
// fournisseur retenu (attribution scindee).
// =====================================================================

const STORAGE_KEY = 'visiba_evaluations_comparatives';

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

export function listEvaluations() {
  return readAll().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// Un dossier peut couvrir plusieurs articles (un "lot") — on le retrouve
// des qu'un de ses articles correspond a articleId.
export function listEvaluationsForArticle(articleId) {
  return listEvaluations().filter((e) => (e.articles || []).some((a) => a.article_id === articleId));
}

export function getEvaluation(id) {
  return readAll().find((e) => e.id === id) || null;
}

export function saveEvaluation(evaluation) {
  const rows = readAll();
  const idx = rows.findIndex((e) => e.id === evaluation.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...evaluation, updated_at: now };
  } else {
    rows.push({ ...evaluation, created_at: now, updated_at: now });
  }
  writeAll(rows);
  return evaluation.id;
}

export function deleteEvaluation(id) {
  writeAll(readAll().filter((e) => e.id !== id));
}
