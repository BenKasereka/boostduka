// =====================================================================
// Persistance locale (navigateur) des feuilles de synthese comparative.
// Tant que Supabase n'est pas branche, cette couche tient lieu d'insert/
// update sur evaluations_comparatives + evaluation_lignes (voir schema.sql).
// Le format des objets stockes reprend directement ces deux tables afin
// qu'un futur `saveEvaluation` puisse ecrire vers Supabase sans changer
// la forme des donnees consommees par l'UI.
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

export function listEvaluationsForArticle(articleId) {
  return listEvaluations().filter((e) => e.article_id === articleId);
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
