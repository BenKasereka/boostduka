import { useEffect, useMemo, useState } from 'react';
import { listCategories, listArticlesByCategorie, listCandidatesForArticle, listSections } from '../lib/dataSource';
import { computeScores, DEFAULT_WEIGHTS, CRITERES } from '../lib/scoring';
import { listEvaluationsForArticle, saveEvaluation, deleteEvaluation } from '../lib/localStore';
import { exportToExcel } from '../lib/exportExcel';

function ScoreCell({ value }) {
  const color = value >= 75 ? 'text-emeraude-700' : value >= 50 ? 'text-or-700' : 'text-red-600';
  return <span className={`font-medium tabular-nums ${color}`}>{value.toFixed(0)}</span>;
}

export default function SyntheseComparative() {
  const [categories, setCategories] = useState([]);
  const [categorieId, setCategorieId] = useState('');
  const [articles, setArticles] = useState([]);
  const [articleId, setArticleId] = useState('');
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');

  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);

  const [retenuId, setRetenuId] = useState('');
  const [justification, setJustification] = useState('');
  const [savedEvaluations, setSavedEvaluations] = useState([]);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    listCategories().then(setCategories);
    listSections().then(setSections);
  }, []);

  useEffect(() => {
    listArticlesByCategorie(categorieId ? Number(categorieId) : undefined).then((a) => {
      setArticles(a);
      setArticleId('');
      setCandidates([]);
    });
  }, [categorieId]);

  useEffect(() => {
    if (!articleId) return;
    setLoading(true);
    setSaveMessage('');
    listCandidatesForArticle(Number(articleId))
      .then((rows) => {
        setCandidates(rows);
        setRetenuId('');
        setJustification('');
      })
      .finally(() => setLoading(false));
    setSavedEvaluations(listEvaluationsForArticle(Number(articleId)));
  }, [articleId]);

  const scored = useMemo(() => computeScores(candidates, weights), [candidates, weights]);
  const selectedArticle = articles.find((a) => a.id === Number(articleId));
  const selectedCategorie = categories.find((c) => c.id === Number(categorieId));

  useEffect(() => {
    if (scored.length > 0 && !retenuId) setRetenuId(scored[0].fournisseur_id);
  }, [scored, retenuId]);

  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);

  function handleWeightChange(key, value) {
    setWeights((w) => ({ ...w, [key]: Math.max(0, Number(value) || 0) }));
  }

  function handleSave() {
    if (!articleId || scored.length === 0) return;
    const retenu = scored.find((s) => s.fournisseur_id === retenuId);
    const section = sections.find((s) => s.id === sectionId);
    const evaluation = {
      id: crypto.randomUUID(),
      article_id: Number(articleId),
      article_nom: selectedArticle?.nom_article,
      categorie_id: Number(categorieId) || selectedArticle?.categorie_id,
      categorie_nom: selectedCategorie?.nom_categorie,
      section_id: sectionId || null,
      section_nom: section?.nom_base || null,
      ponderation: weights,
      lignes: scored,
      fournisseur_retenu_id: retenuId,
      fournisseur_retenu_nom: retenu?.fournisseur_nom,
      justification,
      statut: 'brouillon',
    };
    saveEvaluation(evaluation);
    setSavedEvaluations(listEvaluationsForArticle(Number(articleId)));
    setSaveMessage('Synthèse enregistrée localement.');
  }

  function handleExport() {
    exportToExcel(
      [
        {
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
            'Score pondéré total': s.scores.total,
          })),
        },
      ],
      `VISIBA_Synthese_${(selectedArticle?.nom_article || 'article').replace(/\s+/g, '_')}.xlsx`
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-800">Feuille de synthèse comparative</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Sélection multicritères pondérée : Prix / Qualité / Délai / Disponibilité / Conditions de paiement.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Catégorie</label>
          <select className="input-field" value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
            <option value="">Sélectionner une catégorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.nom_categorie}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Article</label>
          <select className="input-field" value={articleId} onChange={(e) => setArticleId(e.target.value)} disabled={articles.length === 0}>
            <option value="">Sélectionner un article</option>
            {articles.map((a) => (
              <option key={a.id} value={a.id}>{a.nom_article}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Section demandeuse (optionnel)</label>
          <select className="input-field" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">Non spécifiée</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.nom_base}</option>
            ))}
          </select>
        </div>
      </div>

      {articleId && (
        <>
          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-medium text-slate-500">Pondération des critères (%)</div>
              <div className={`text-xs font-medium ${weightSum === 100 ? 'text-emeraude-700' : 'text-or-700'}`}>
                Total : {weightSum}% {weightSum !== 100 && '(sera renormalisé automatiquement)'}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {CRITERES.map((c) => (
                <div key={c.key}>
                  <label className="text-xs text-slate-500 mb-1 block">{c.label}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input-field"
                    value={weights[c.key]}
                    onChange={(e) => handleWeightChange(c.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="text-sm font-medium text-slate-700">
                {candidates.length} fournisseur(s) candidat(s) pour « {selectedArticle?.nom_article} »
              </div>
              <button className="btn-secondary" onClick={handleExport} disabled={scored.length === 0}>
                Exporter Excel
              </button>
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
                    <th className="table-th text-center">Total pondéré</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && <tr><td className="table-td text-slate-400" colSpan={11}>Chargement…</td></tr>}
                  {!loading && scored.length === 0 && (
                    <tr><td className="table-td text-slate-400" colSpan={11}>Aucun devis disponible pour cet article.</td></tr>
                  )}
                  {!loading && scored.map((s, idx) => (
                    <tr key={s.fournisseur_id} className={idx === 0 ? 'bg-emeraude-50/40' : ''}>
                      <td className="table-td text-center">
                        <input
                          type="radio"
                          name="retenu"
                          checked={retenuId === s.fournisseur_id}
                          onChange={() => setRetenuId(s.fournisseur_id)}
                        />
                      </td>
                      <td className="table-td font-medium text-slate-800">
                        {s.fournisseur_nom}
                        {idx === 0 && <span className="badge bg-emeraude-100 text-emeraude-700 ml-2 text-[10px]">Meilleur score</span>}
                        <div className="text-xs text-slate-400 font-normal">{s.province_nom}</div>
                      </td>
                      <td className="table-td text-right">{s.prix_unitaire.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {s.devise}</td>
                      <td className="table-td text-center"><ScoreCell value={s.scores.prix} /></td>
                      <td className="table-td text-center"><ScoreCell value={s.scores.qualite} /></td>
                      <td className="table-td text-center">{s.delai_livraison_jours}</td>
                      <td className="table-td text-center"><ScoreCell value={s.scores.delai} /></td>
                      <td className="table-td text-center"><ScoreCell value={s.scores.disponibilite} /></td>
                      <td className="table-td text-xs text-slate-500">{s.conditions_paiement}</td>
                      <td className="table-td text-center"><ScoreCell value={s.scores.conditions} /></td>
                      <td className="table-td text-center text-base font-semibold text-marine-700">{s.scores.total.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">
              Méthodologie : Prix et Délai normalisés entre candidats (moins cher/plus rapide = 100). Qualité = score de fiabilité fournisseur.
              Disponibilité = fournisseur actif + offre encore valide. Conditions de paiement = grille de notation fixe favorisant le crédit accordé à l'acheteur.
            </div>
          </div>

          {scored.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 space-y-3">
              <div className="text-sm font-medium text-slate-700">Sélection et justification</div>
              <div className="text-sm">
                Fournisseur retenu : <span className="font-semibold text-marine-700">{scored.find((s) => s.fournisseur_id === retenuId)?.fournisseur_nom}</span>
              </div>
              <textarea
                className="input-field min-h-[90px]"
                placeholder="Justification de l'attribution (ex: meilleur compromis prix/délai, historique de fiabilité, contrat-cadre existant...)"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <button className="btn-primary" onClick={handleSave}>Enregistrer la synthèse</button>
                {saveMessage && <span className="text-xs text-emeraude-700">{saveMessage}</span>}
              </div>
            </div>
          )}

          {savedEvaluations.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-sm font-medium text-slate-700 mb-2">Synthèses enregistrées pour cet article</div>
              <ul className="divide-y divide-slate-100">
                {savedEvaluations.map((ev) => (
                  <li key={ev.id} className="py-2 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{ev.fournisseur_retenu_nom}</span>
                      <span className="text-slate-400 ml-2 text-xs">{new Date(ev.created_at).toLocaleString('fr-FR')}</span>
                    </div>
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => {
                        deleteEvaluation(ev.id);
                        setSavedEvaluations(listEvaluationsForArticle(Number(articleId)));
                      }}
                    >
                      Supprimer
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
