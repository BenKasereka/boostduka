import { useEffect, useState } from 'react';
import { listEvaluations, saveEvaluation } from '../lib/localStore';
import { CRITERES } from '../lib/scoring';

function refFromId(id) {
  return `CBA-${id.slice(0, 8).toUpperCase()}`;
}

export default function CBA() {
  const [evaluations, setEvaluations] = useState([]);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    const all = listEvaluations();
    setEvaluations(all);
    if (all.length > 0 && !all.some((e) => e.id === selectedId)) setSelectedId(all[0].id);
    if (all.length === 0) setSelectedId('');
  }

  const evaluation = evaluations.find((e) => e.id === selectedId);

  function handleValidate() {
    if (!evaluation) return;
    saveEvaluation({ ...evaluation, statut: 'valide' });
    refresh();
  }

  if (evaluations.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center">
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Aucune synthèse comparative enregistrée</h2>
        <p className="text-sm text-slate-500">
          Créez d'abord une feuille de synthèse comparative (module précédent) pour pouvoir générer un dossier CBA à partir de celle-ci.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="no-print flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">CBA — Comparative Bid Analysis</h1>
          <p className="text-sm text-slate-500 mt-0.5">Document d'audit imprimable, généré à partir d'une synthèse comparative validée.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input-field !w-auto min-w-[260px]" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {evaluations.map((e) => (
              <option key={e.id} value={e.id}>
                {e.article_nom} — {e.fournisseur_retenu_nom} ({new Date(e.created_at).toLocaleDateString('fr-FR')})
              </option>
            ))}
          </select>
          {evaluation?.statut !== 'valide' && (
            <button className="btn-secondary" onClick={handleValidate}>Marquer comme validé</button>
          )}
          <button className="btn-primary" onClick={() => window.print()}>Imprimer / Exporter PDF</button>
        </div>
      </div>

      {evaluation && (
        <div className="printable-area bg-white border border-slate-200 rounded-lg p-8">
          <div className="flex items-start justify-between border-b-2 border-marine-700 pb-4 mb-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400">VISIBA Logistics Group</div>
              <h2 className="text-lg font-bold text-marine-700 mt-1">Comparative Bid Analysis (CBA)</h2>
              <div className="text-xs text-slate-500 mt-1">Réf. {refFromId(evaluation.id)}</div>
            </div>
            <div className="text-right">
              <span className={`badge ${evaluation.statut === 'valide' ? 'bg-emeraude-50 text-emeraude-700' : 'bg-or-50 text-or-700'}`}>
                {evaluation.statut === 'valide' ? 'VALIDÉ' : 'BROUILLON'}
              </span>
              <div className="text-xs text-slate-500 mt-2">Généré le {new Date().toLocaleDateString('fr-FR')}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-sm">
            <div>
              <div className="text-xs text-slate-400">Section demandeuse</div>
              <div className="font-medium">{evaluation.section_nom || 'Intersection Procurement'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Catégorie</div>
              <div className="font-medium">{evaluation.categorie_nom}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Article</div>
              <div className="font-medium">{evaluation.article_nom}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Offres comparées</div>
              <div className="font-medium">{evaluation.lignes.length} fournisseur(s)</div>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Pondération des critères de sélection</div>
            <div className="flex flex-wrap gap-2">
              {CRITERES.map((c) => (
                <span key={c.key} className="badge bg-marine-50 text-marine-700">{c.label} : {evaluation.ponderation[c.key]}%</span>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Offres comparées</div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="text-left py-1.5 font-semibold text-slate-600">Fournisseur</th>
                  <th className="text-left py-1.5 font-semibold text-slate-600">Province</th>
                  <th className="text-right py-1.5 font-semibold text-slate-600">Prix</th>
                  <th className="text-center py-1.5 font-semibold text-slate-600">Délai (j)</th>
                  <th className="text-left py-1.5 font-semibold text-slate-600">Conditions paiement</th>
                  <th className="text-center py-1.5 font-semibold text-slate-600">Score total</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.lignes.map((l) => {
                  const retenu = l.fournisseur_id === evaluation.fournisseur_retenu_id;
                  return (
                    <tr key={l.fournisseur_id} className={`border-b border-slate-100 ${retenu ? 'bg-emeraude-50/50 font-medium' : ''}`}>
                      <td className="py-1.5">{l.fournisseur_nom}{retenu && ' ✓'}</td>
                      <td className="py-1.5 text-slate-500">{l.province_nom}</td>
                      <td className="py-1.5 text-right">{l.prix_unitaire.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {l.devise}</td>
                      <td className="py-1.5 text-center">{l.delai_livraison_jours}</td>
                      <td className="py-1.5 text-xs text-slate-500">{l.conditions_paiement}</td>
                      <td className="py-1.5 text-center font-semibold text-marine-700">{l.scores.total.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border border-emeraude-200 bg-emeraude-50/40 rounded-md p-4 mb-8">
            <div className="text-xs font-semibold uppercase tracking-wide text-emeraude-700 mb-1">Fournisseur retenu</div>
            <div className="text-base font-semibold text-slate-800 mb-1">{evaluation.fournisseur_retenu_nom}</div>
            <div className="text-xs text-slate-400 mb-1">Justification d'attribution</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{evaluation.justification || '—'}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-6">Préparé par (Procurement Analyst)</div>
              <div className="border-b border-slate-300 pb-1 mb-1">&nbsp;</div>
              <div className="text-xs text-slate-400">Nom, signature, date</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-6">Approuvé par (Procurement Manager / Coordination)</div>
              <div className="border-b border-slate-300 pb-1 mb-1">&nbsp;</div>
              <div className="text-xs text-slate-400">Nom, signature, date</div>
            </div>
          </div>

          <div className="mt-8 pt-3 border-t border-slate-100 text-[10px] text-slate-400 text-center">
            Document généré par VISIBA Procurement Intelligence Hub — preuve d'audit procurement — {new Date().toLocaleString('fr-FR')}
          </div>
        </div>
      )}
    </div>
  );
}
