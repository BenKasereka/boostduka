import { useEffect, useState } from 'react';
import { listEvaluations, saveEvaluation } from '../lib/localStore';
import { CRITERES } from '../lib/scoring';
import { convertPourAffichage, formatMoney } from '../lib/currency';
import { useDevisePreference } from '../lib/DevisePreferenceContext';

function refFromId(id) {
  return `CBA-${id.slice(0, 8).toUpperCase()}`;
}

function MontantAffiche({ montant, devise }) {
  const { devisePrincipale, deviseSecondaire } = useDevisePreference();
  const { principal, principalCode, secondaire, secondaireCode } = convertPourAffichage(montant, devise, devisePrincipale, deviseSecondaire);
  return (
    <>
      {formatMoney(principal, principalCode)}
      {secondaire != null && <span className="text-slate-400 text-[10px]"> (≈{formatMoney(secondaire, secondaireCode)})</span>}
    </>
  );
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
  const criteresPersonnalises = evaluation?.criteresPersonnalises || [];

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
            {evaluations.map((e) => {
              const noms = (e.articles || []).map((a) => a.article_nom).join(', ') || 'Dossier vide';
              return (
                <option key={e.id} value={e.id}>
                  {noms} ({new Date(e.created_at).toLocaleDateString('fr-FR')})
                </option>
              );
            })}
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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 text-sm">
            <div>
              <div className="text-xs text-slate-400">Section demandeuse</div>
              <div className="font-medium">{evaluation.section_nom || 'Intersection Procurement'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Articles du dossier (lot)</div>
              <div className="font-medium">{(evaluation.articles || []).length} article(s)</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Fournisseurs distincts retenus</div>
              <div className="font-medium">
                {new Set((evaluation.articles || []).map((a) => a.fournisseur_retenu_id)).size}
                {(evaluation.articles || []).length > 1 && new Set((evaluation.articles || []).map((a) => a.fournisseur_retenu_id)).size > 1 && (
                  <span className="text-[10px] text-or-700 ml-1 font-normal">(attribution scindée)</span>
                )}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Pondération des critères de sélection</div>
            <div className="flex flex-wrap gap-2">
              {CRITERES.map((c) => (
                <span key={c.key} className="badge bg-marine-50 text-marine-700">{c.label} : {evaluation.ponderation[c.key]}%</span>
              ))}
              {criteresPersonnalises.map((c) => (
                <span key={c.id} className="badge bg-or-50 text-or-700">{c.label} : {c.poids}%</span>
              ))}
            </div>
          </div>

          {(evaluation.articles || []).map((art, i) => (
            <div key={art.article_id} className="mb-8 break-inside-avoid">
              <div className="text-sm font-bold text-slate-800 mb-2 pb-1 border-b border-slate-200">
                {i + 1}. {art.article_nom} <span className="text-xs font-normal text-slate-400">({art.categorie_nom})</span>
              </div>

              <table className="w-full border-collapse text-sm mb-3">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="text-left py-1.5 font-semibold text-slate-600">Fournisseur</th>
                    <th className="text-left py-1.5 font-semibold text-slate-600">Province</th>
                    <th className="text-right py-1.5 font-semibold text-slate-600">Prix</th>
                    <th className="text-center py-1.5 font-semibold text-slate-600">Délai (j)</th>
                    <th className="text-center py-1.5 font-semibold text-slate-600">Transport</th>
                    <th className="text-center py-1.5 font-semibold text-slate-600">Stock</th>
                    <th className="text-left py-1.5 font-semibold text-slate-600">Conditions paiement</th>
                    <th className="text-center py-1.5 font-semibold text-slate-600">Score total</th>
                  </tr>
                </thead>
                <tbody>
                  {art.lignes.map((l) => {
                    const retenu = l.fournisseur_id === art.fournisseur_retenu_id;
                    return (
                      <tr key={l.fournisseur_id} className={`border-b border-slate-100 ${retenu ? 'bg-emeraude-50/50 font-medium' : ''}`}>
                        <td className="py-1.5">{l.fournisseur_nom}{retenu && ' ✓'}</td>
                        <td className="py-1.5 text-slate-500">{l.province_nom}</td>
                        <td className="py-1.5 text-right">
                          <MontantAffiche montant={l.prix_unitaire} devise={l.devise} />
                        </td>
                        <td className="py-1.5 text-center">{l.delai_livraison_jours}</td>
                        <td className="py-1.5 text-center">{l.transport_inclus ? 'Oui' : 'Non'}</td>
                        <td className="py-1.5 text-center">{l.stock_disponible === 0 ? 'Rupture' : l.stock_disponible}</td>
                        <td className="py-1.5 text-xs text-slate-500">{l.conditions_paiement}</td>
                        <td className="py-1.5 text-center font-semibold text-marine-700">{l.scores.total.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="border border-emeraude-200 bg-emeraude-50/40 rounded-md p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-emeraude-700 mb-1">Fournisseur retenu</div>
                <div className="text-sm font-semibold text-slate-800 mb-1">{art.fournisseur_retenu_nom || '—'}</div>
                <div className="text-xs text-slate-400 mb-1">Justification d'attribution</div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{art.justification || '—'}</p>
              </div>
            </div>
          ))}

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
            Document généré par BoostDuka — preuve d'audit procurement — {new Date().toLocaleString('fr-FR')}
          </div>
        </div>
      )}
    </div>
  );
}
