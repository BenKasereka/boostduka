import { useEffect, useMemo, useState } from 'react';
import { listCategories, listArticlesByCategorie, listCandidatesForArticle, listSections } from '../lib/dataSource';
import { computeScores, DEFAULT_WEIGHTS, CRITERES } from '../lib/scoring';
import { listEvaluations, saveEvaluation, deleteEvaluation } from '../lib/localStore';
import { exportToExcel } from '../lib/exportExcel';

function ScoreCell({ value }) {
  const color = value >= 75 ? 'text-emeraude-700' : value >= 50 ? 'text-or-700' : 'text-red-600';
  return <span className={`font-medium tabular-nums ${color}`}>{value.toFixed(0)}</span>;
}

function AjoutArticle({ categories, onAdd }) {
  const [categorieId, setCategorieId] = useState('');
  const [articles, setArticles] = useState([]);
  const [articleId, setArticleId] = useState('');

  useEffect(() => {
    listArticlesByCategorie(categorieId ? Number(categorieId) : undefined).then((a) => {
      setArticles(a);
      setArticleId('');
    });
  }, [categorieId]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Catégorie</label>
        <select className="input-field" value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
          <option value="">Toutes catégories</option>
          {categories.map((c) => (<option key={c.id} value={c.id}>{c.nom_categorie}</option>))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Article à ajouter à la comparaison</label>
        <select className="input-field" value={articleId} onChange={(e) => setArticleId(e.target.value)}>
          <option value="">Sélectionner un article</option>
          {articles.map((a) => (<option key={a.id} value={a.id}>{a.nom_article}</option>))}
        </select>
      </div>
      <button
        className="btn-primary"
        disabled={!articleId}
        onClick={() => {
          const article = articles.find((a) => a.id === Number(articleId));
          if (article) onAdd(article);
          setArticleId('');
        }}
      >
        + Ajouter cet article
      </button>
    </div>
  );
}

function PonderationPanel({ weights, onWeightChange, criteres, onAddCritere, onRemoveCritere, onCritereWeightChange }) {
  const [label, setLabel] = useState('');
  const [poids, setPoids] = useState(10);
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0) + criteres.reduce((a, c) => a + c.poids, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-medium text-slate-500">Pondération des critères (%) — s'applique à tous les articles du dossier</div>
        <div className={`text-xs font-medium ${weightSum === 100 ? 'text-emeraude-700' : 'text-or-700'}`}>
          Total : {weightSum}% {weightSum !== 100 && '(renormalisé automatiquement)'}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
        {CRITERES.map((c) => (
          <div key={c.key}>
            <label className="text-xs text-slate-500 mb-1 block">{c.label}</label>
            <input
              type="number" min="0" max="100" className="input-field"
              value={weights[c.key]} onChange={(e) => onWeightChange(c.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      {criteres.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3 pt-3 border-t border-slate-100">
          {criteres.map((c) => (
            <div key={c.id}>
              <label className="text-xs text-slate-500 mb-1 flex items-center justify-between">
                <span className="truncate">{c.label}</span>
                <button type="button" className="text-red-500 hover:text-red-700 ml-1" onClick={() => onRemoveCritere(c.id)} title="Retirer ce critère">×</button>
              </label>
              <input
                type="number" min="0" max="100" className="input-field"
                value={c.poids} onChange={(e) => onCritereWeightChange(c.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 pt-3 border-t border-slate-100">
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">Nouveau critère personnalisé (spécification du demandeur)</label>
          <input className="input-field" placeholder="ex: Conformité norme ISO, marque exigée..." value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="w-24">
          <label className="text-xs text-slate-500 mb-1 block">Poids</label>
          <input type="number" min="0" max="100" className="input-field" value={poids} onChange={(e) => setPoids(Number(e.target.value) || 0)} />
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={!label.trim()}
          onClick={() => { onAddCritere(label.trim(), poids); setLabel(''); setPoids(10); }}
        >
          + Ajouter un critère
        </button>
      </div>
    </div>
  );
}

function ArticleBlock({ entry, scored, criteres, onRetenuChange, onJustificationChange, onCustomScoreChange, onRemove, onExport }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <div className="text-sm font-semibold text-slate-800">{entry.article_nom}</div>
          <div className="text-xs text-slate-400">{entry.categorie_nom} · {scored.length} fournisseur(s) candidat(s)</div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onExport}>Exporter Excel</button>
          <button className="text-xs text-red-600 hover:underline px-2" onClick={onRemove}>Retirer cet article</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="table-th">Retenu</th>
              <th className="table-th">Fournisseur</th>
              <th className="table-th text-right">Prix</th>
              <th className="table-th text-center">Score Prix</th>
              <th className="table-th text-center">Score Qualité</th>
              <th className="table-th text-center">Délai (j)</th>
              <th className="table-th text-center">Score Délai</th>
              <th className="table-th text-center">Score Dispo.</th>
              <th className="table-th">Conditions</th>
              <th className="table-th text-center">Score Cond.</th>
              {criteres.map((c) => (
                <th key={c.id} className="table-th text-center">{c.label}</th>
              ))}
              <th className="table-th text-center">Total pondéré</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scored.length === 0 && (
              <tr><td className="table-td text-slate-400" colSpan={11 + criteres.length}>Aucun devis disponible pour cet article.</td></tr>
            )}
            {scored.map((s, idx) => (
              <tr key={s.fournisseur_id} className={idx === 0 ? 'bg-emeraude-50/40' : ''}>
                <td className="table-td text-center">
                  <input
                    type="radio"
                    name={`retenu-${entry.article_id}`}
                    checked={entry.retenuId === s.fournisseur_id}
                    onChange={() => onRetenuChange(s.fournisseur_id)}
                  />
                </td>
                <td className="table-td font-medium text-slate-800">
                  {s.fournisseur_nom}
                  {idx === 0 && <span className="badge bg-emeraude-100 text-emeraude-700 ml-2 text-[10px]">Meilleur score</span>}
                  <div className="text-xs text-slate-400 font-normal">{s.province_nom}</div>
                </td>
                <td className="table-td text-right">
                  {s.prix_unitaire.toLocaleString('fr-FR', { minimumFractionDigits: s.devise === 'CDF' ? 0 : 2 })} {s.devise}
                  {s.devise !== 'USD' && <div className="text-[10px] text-slate-400">≈ ${s.prix_unitaire_usd.toFixed(2)}</div>}
                </td>
                <td className="table-td text-center"><ScoreCell value={s.scores.prix} /></td>
                <td className="table-td text-center"><ScoreCell value={s.scores.qualite} /></td>
                <td className="table-td text-center">{s.delai_livraison_jours}</td>
                <td className="table-td text-center"><ScoreCell value={s.scores.delai} /></td>
                <td className="table-td text-center"><ScoreCell value={s.scores.disponibilite} /></td>
                <td className="table-td text-xs text-slate-500">{s.conditions_paiement}</td>
                <td className="table-td text-center"><ScoreCell value={s.scores.conditions} /></td>
                {criteres.map((c) => (
                  <td key={c.id} className="table-td text-center">
                    <input
                      type="number" min="0" max="100"
                      className="w-16 text-center text-sm border border-slate-200 rounded px-1 py-0.5"
                      value={entry.customScores?.[s.fournisseur_id]?.[c.id] ?? 0}
                      onChange={(e) => onCustomScoreChange(s.fournisseur_id, c.id, Number(e.target.value) || 0)}
                    />
                  </td>
                ))}
                <td className="table-td text-center text-base font-semibold text-marine-700">{s.scores.total.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {scored.length > 0 && (
        <div className="p-4 border-t border-slate-100 space-y-2">
          <div className="text-sm">
            Fournisseur retenu pour cet article : <span className="font-semibold text-marine-700">{scored.find((s) => s.fournisseur_id === entry.retenuId)?.fournisseur_nom || '—'}</span>
          </div>
          <textarea
            className="input-field min-h-[70px]"
            placeholder="Justification de l'attribution pour cet article..."
            value={entry.justification}
            onChange={(e) => onJustificationChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export default function SyntheseComparative() {
  const [categories, setCategories] = useState([]);
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');

  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [criteres, setCriteres] = useState([]);

  const [articleEntries, setArticleEntries] = useState([]);
  const [savedEvaluations, setSavedEvaluations] = useState([]);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    listCategories().then(setCategories);
    listSections().then(setSections);
    setSavedEvaluations(listEvaluations());
  }, []);

  const scoredEntries = useMemo(
    () => articleEntries.map((entry) => ({
      entry,
      scored: computeScores(entry.candidates, weights, { criteresPersonnalises: criteres, customScores: entry.customScores }),
    })),
    [articleEntries, weights, criteres]
  );

  // Defaut : retenu = meilleur score, uniquement au premier calcul d'un article
  // (ne remplace jamais un choix deja fait manuellement).
  useEffect(() => {
    scoredEntries.forEach(({ entry, scored }, idx) => {
      if (!entry.retenuId && scored.length > 0) {
        setArticleEntries((prev) => {
          const copy = [...prev];
          if (copy[idx] && !copy[idx].retenuId) copy[idx] = { ...copy[idx], retenuId: scored[0].fournisseur_id };
          return copy;
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoredEntries.length]);

  async function handleAddArticle(article) {
    if (articleEntries.some((e) => e.article_id === article.id)) return;
    const candidates = await listCandidatesForArticle(article.id);
    const categorie = categories.find((c) => c.id === article.categorie_id);
    setArticleEntries((prev) => [
      ...prev,
      {
        article_id: article.id,
        article_nom: article.nom_article,
        categorie_id: article.categorie_id,
        categorie_nom: categorie?.nom_categorie ?? '—',
        candidates,
        customScores: {},
        retenuId: '',
        justification: '',
      },
    ]);
  }

  function updateEntry(index, patch) {
    setArticleEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function updateCustomScore(index, fournisseurId, critereId, value) {
    setArticleEntries((prev) => prev.map((e, i) => {
      if (i !== index) return e;
      const customScores = { ...e.customScores, [fournisseurId]: { ...e.customScores[fournisseurId], [critereId]: value } };
      return { ...e, customScores };
    }));
  }

  function handleWeightChange(key, value) {
    setWeights((w) => ({ ...w, [key]: Math.max(0, Number(value) || 0) }));
  }

  function handleAddCritere(label, poids) {
    setCriteres((prev) => [...prev, { id: crypto.randomUUID(), label, poids: Math.max(0, poids) }]);
  }

  function handleRemoveCritere(id) {
    setCriteres((prev) => prev.filter((c) => c.id !== id));
  }

  function handleCritereWeightChange(id, value) {
    setCriteres((prev) => prev.map((c) => (c.id === id ? { ...c, poids: Math.max(0, Number(value) || 0) } : c)));
  }

  function handleExportArticle(scored, article_nom) {
    exportToExcel(
      [{
        name: 'Synthese comparative',
        rows: scored.map((s) => ({
          Fournisseur: s.fournisseur_nom,
          Province: s.province_nom,
          'Prix unitaire': s.prix_unitaire,
          Devise: s.devise,
          'Score Prix': s.scores.prix,
          'Score Qualité': s.scores.qualite,
          'Délai (j)': s.delai_livraison_jours,
          'Score Délai': s.scores.delai,
          'Score Disponibilité': s.scores.disponibilite,
          'Conditions paiement': s.conditions_paiement,
          'Score Conditions': s.scores.conditions,
          ...Object.fromEntries((s.scores.personnalises || []).map((p) => [p.label, p.valeur])),
          'Score pondéré total': s.scores.total,
        })),
      }],
      `VISIBA_Synthese_${article_nom.replace(/\s+/g, '_')}.xlsx`
    );
  }

  function handleSaveDossier() {
    if (articleEntries.length === 0) return;
    const section = sections.find((s) => s.id === sectionId);
    const evaluation = {
      id: crypto.randomUUID(),
      section_id: sectionId || null,
      section_nom: section?.nom_base || null,
      ponderation: weights,
      criteresPersonnalises: criteres,
      articles: scoredEntries.map(({ entry, scored }) => ({
        article_id: entry.article_id,
        article_nom: entry.article_nom,
        categorie_nom: entry.categorie_nom,
        lignes: scored,
        fournisseur_retenu_id: entry.retenuId,
        fournisseur_retenu_nom: scored.find((s) => s.fournisseur_id === entry.retenuId)?.fournisseur_nom,
        justification: entry.justification,
      })),
      statut: 'brouillon',
    };
    saveEvaluation(evaluation);
    setSavedEvaluations(listEvaluations());
    setSaveMessage(`Dossier enregistré (${articleEntries.length} article(s)).`);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-800">Feuille de synthèse comparative</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Comparez plusieurs articles dans un même dossier (un "lot") et attribuez chacun au fournisseur le plus favorable —
          l'attribution peut être scindée entre plusieurs fournisseurs différents.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <label className="text-xs font-medium text-slate-500 mb-1 block">Section demandeuse (optionnel, s'applique à tout le dossier)</label>
        <select className="input-field max-w-sm" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">Non spécifiée</option>
          {sections.map((s) => (<option key={s.id} value={s.id}>{s.nom_base}</option>))}
        </select>
      </div>

      <AjoutArticle categories={categories} onAdd={handleAddArticle} />

      {articleEntries.length > 0 && (
        <>
          <PonderationPanel
            weights={weights}
            onWeightChange={handleWeightChange}
            criteres={criteres}
            onAddCritere={handleAddCritere}
            onRemoveCritere={handleRemoveCritere}
            onCritereWeightChange={handleCritereWeightChange}
          />

          {scoredEntries.map(({ entry, scored }, idx) => (
            <ArticleBlock
              key={entry.article_id}
              entry={entry}
              scored={scored}
              criteres={criteres}
              onRetenuChange={(id) => updateEntry(idx, { retenuId: id })}
              onJustificationChange={(v) => updateEntry(idx, { justification: v })}
              onCustomScoreChange={(fid, cid, v) => updateCustomScore(idx, fid, cid, v)}
              onRemove={() => setArticleEntries((prev) => prev.filter((_, i) => i !== idx))}
              onExport={() => handleExportArticle(scored, entry.article_nom)}
            />
          ))}

          <div className="text-[11px] text-slate-400 -mt-2 mb-4">
            Méthodologie : Prix et Délai normalisés entre candidats (moins cher/plus rapide = 100). Qualité = score de fiabilité fournisseur.
            Disponibilité = fournisseur actif + offre encore valide. Conditions de paiement = grille de notation fixe. Les critères
            personnalisés sont notés manuellement (0-100) par l'analyste, selon les spécifications du demandeur.
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 flex items-center gap-3">
            <button className="btn-primary" onClick={handleSaveDossier}>Enregistrer le dossier ({articleEntries.length} article(s))</button>
            {saveMessage && <span className="text-xs text-emeraude-700">{saveMessage}</span>}
          </div>
        </>
      )}

      {savedEvaluations.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-sm font-medium text-slate-700 mb-2">Dossiers enregistrés récemment</div>
          <ul className="divide-y divide-slate-100">
            {savedEvaluations.slice(0, 10).map((ev) => (
              <li key={ev.id} className="py-2 flex items-center justify-between text-sm gap-3">
                <div className="min-w-0">
                  <span className="font-medium">{(ev.articles || []).map((a) => a.article_nom).join(', ') || '—'}</span>
                  <span className="text-slate-400 ml-2 text-xs">{new Date(ev.created_at).toLocaleString('fr-FR')} · {(ev.articles || []).length} article(s)</span>
                </div>
                <button
                  className="text-xs text-red-600 hover:underline shrink-0"
                  onClick={() => {
                    deleteEvaluation(ev.id);
                    setSavedEvaluations(listEvaluations());
                  }}
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
