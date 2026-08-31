import { useEffect, useMemo, useState } from 'react';
import { listSections, listFournisseurRows, commitCreerCommandes } from '../lib/dataSource';
import { listEvaluations, saveEvaluation } from '../lib/localStore';
import { toUsd, convertPourAffichage, formatMoney } from '../lib/currency';
import { useDevisePreference } from '../lib/DevisePreferenceContext';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addJours(dateISO, jours) {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + (jours || 0));
  return d.toISOString().slice(0, 10);
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

// Regroupe les articles d'un dossier CBA validé par fournisseur retenu —
// un dossier avec attribution scindée produit un groupe (donc un PO) par
// fournisseur distinct.
function buildGroups(evaluation) {
  const groups = {};
  (evaluation.articles || []).forEach((art) => {
    const ligne = (art.lignes || []).find((l) => l.fournisseur_id === art.fournisseur_retenu_id);
    if (!ligne) return;
    const fid = art.fournisseur_retenu_id;
    if (!groups[fid]) groups[fid] = { fournisseur_id: fid, fournisseur_nom: art.fournisseur_retenu_nom, lignes: [] };
    groups[fid].lignes.push({
      article_id: art.article_id,
      article_nom: art.article_nom,
      prix_unitaire: ligne.prix_unitaire,
      devise: ligne.devise,
      delai_livraison_jours: ligne.delai_livraison_jours,
      conditions_paiement: ligne.conditions_paiement,
      quantite_defaut: ligne.quantite_reference || 1,
    });
  });
  return Object.values(groups);
}

export default function BonDeCommande() {
  const [sections, setSections] = useState([]);
  const [fournisseursById, setFournisseursById] = useState({});
  const [evaluations, setEvaluations] = useState([]);
  const [evaluationId, setEvaluationId] = useState('');
  const [fournisseurId, setFournisseurId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [quantites, setQuantites] = useState({});
  const [datesLivraison, setDatesLivraison] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    listSections().then(setSections);
    listFournisseurRows().then((rows) => setFournisseursById(Object.fromEntries(rows.map((f) => [f.id, f]))));
    refresh();
  }, []);

  function refresh() {
    const valides = listEvaluations().filter((e) => e.statut === 'valide');
    setEvaluations(valides);
    if (valides.length > 0 && !valides.some((e) => e.id === evaluationId)) setEvaluationId(valides[0].id);
    if (valides.length === 0) setEvaluationId('');
  }

  const evaluation = evaluations.find((e) => e.id === evaluationId);
  const groups = useMemo(() => (evaluation ? buildGroups(evaluation) : []), [evaluation]);

  useEffect(() => {
    if (groups.length > 0 && !groups.some((g) => g.fournisseur_id === fournisseurId)) {
      setFournisseurId(groups[0].fournisseur_id);
    }
    if (groups.length === 0) setFournisseurId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationId, groups.length]);

  const group = groups.find((g) => g.fournisseur_id === fournisseurId);

  // Prefill section depuis le dossier CBA (modifiable), quantites/dates par defaut a chaque changement de groupe.
  useEffect(() => {
    if (!group) return;
    setSectionId(evaluation?.section_id || '');
    const q = {}; const d = {};
    group.lignes.forEach((l) => {
      q[l.article_id] = l.quantite_defaut;
      d[l.article_id] = addJours(todayISO(), l.delai_livraison_jours);
    });
    setQuantites(q);
    setDatesLivraison(d);
    setMessage('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fournisseurId, evaluationId]);

  const dejaGenere = evaluation?.commandes_generees?.[fournisseurId];
  const fournisseurDetail = fournisseursById[fournisseurId];

  const totalUsd = group
    ? group.lignes.reduce((sum, l) => sum + toUsd(l.prix_unitaire, l.devise) * (Number(quantites[l.article_id]) || 0), 0)
    : 0;

  async function handleConfirmer() {
    if (!group || !sectionId) return;
    const poId = crypto.randomUUID();
    const reference = `PO-${poId.slice(0, 8).toUpperCase()}`;
    const rows = group.lignes.map((l) => ({
      id: crypto.randomUUID(),
      section_id: sectionId,
      fournisseur_id: group.fournisseur_id,
      article_id: l.article_id,
      quantite: Number(quantites[l.article_id]) || 1,
      prix_unitaire: l.prix_unitaire,
      devise: l.devise,
      date_pr: todayISO(),
      date_po: todayISO(),
      date_livraison_prevue: datesLivraison[l.article_id] || null,
      date_livraison_reelle: null,
      statut: 'en_cours',
      ecart_jours: null,
    }));
    await commitCreerCommandes(rows);
    const updated = {
      ...evaluation,
      commandes_generees: {
        ...(evaluation.commandes_generees || {}),
        [group.fournisseur_id]: { reference, date: todayISO(), commande_ids: rows.map((r) => r.id) },
      },
    };
    saveEvaluation(updated);
    refresh();
    setMessage(`Bon de commande ${reference} enregistré (${rows.length} ligne(s)) — visible dans le Dashboard KPI.`);
  }

  if (evaluations.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center">
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Aucun dossier CBA validé</h2>
        <p className="text-sm text-slate-500">
          Générez d'abord un CBA (module précédent) et marquez-le comme validé pour pouvoir en tirer un Bon de Commande.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="no-print flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Bon de Commande (PO)</h1>
          <p className="text-sm text-slate-500 mt-0.5">Généré à partir d'un dossier CBA validé — un PO par fournisseur retenu (attribution scindée).</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input-field !w-auto min-w-[240px]" value={evaluationId} onChange={(e) => setEvaluationId(e.target.value)}>
            {evaluations.map((e) => {
              const noms = (e.articles || []).map((a) => a.article_nom).join(', ') || 'Dossier vide';
              return (<option key={e.id} value={e.id}>{noms} ({new Date(e.created_at).toLocaleDateString('fr-FR')})</option>);
            })}
          </select>
          {groups.length > 1 && (
            <select className="input-field !w-auto min-w-[200px]" value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)}>
              {groups.map((g) => (<option key={g.fournisseur_id} value={g.fournisseur_id}>{g.fournisseur_nom}</option>))}
            </select>
          )}
        </div>
      </div>

      {!group && (
        <div className="text-sm text-slate-400 text-center py-10">Ce dossier ne contient aucune ligne attribuée exploitable.</div>
      )}

      {group && (
        <>
          <div className="no-print bg-white border border-slate-200 rounded-lg p-4 mb-4">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Section demandeuse (requis pour enregistrer la commande)</label>
            <select className="input-field max-w-sm" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">Sélectionner une section</option>
              {sections.map((s) => (<option key={s.id} value={s.id}>{s.nom_base}</option>))}
            </select>
          </div>

          <div className="printable-area bg-white border border-slate-200 rounded-lg p-8 mb-4">
            <div className="flex items-start justify-between border-b-2 border-marine-700 pb-4 mb-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-400">VISIBA Logistics Group</div>
                <h2 className="text-lg font-bold text-marine-700 mt-1">Bon de Commande (Purchase Order)</h2>
                <div className="text-xs text-slate-500 mt-1">Réf. {dejaGenere?.reference || 'Non enregistré — brouillon'}</div>
              </div>
              <div className="text-right">
                <span className={`badge ${dejaGenere ? 'bg-emeraude-50 text-emeraude-700' : 'bg-or-50 text-or-700'}`}>
                  {dejaGenere ? 'ENREGISTRÉ' : 'BROUILLON'}
                </span>
                <div className="text-xs text-slate-500 mt-2">Émis le {dejaGenere ? new Date(dejaGenere.date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 text-sm">
              <div>
                <div className="text-xs text-slate-400">Fournisseur</div>
                <div className="font-medium">{group.fournisseur_nom}</div>
                <div className="text-xs text-slate-500">{fournisseurDetail?.email_contact || '—'} {fournisseurDetail?.telephone_contact ? `· ${fournisseurDetail.telephone_contact}` : ''}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Conditions de paiement</div>
                <div className="font-medium">{group.lignes[0]?.conditions_paiement || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Section demandeuse</div>
                <div className="font-medium">{sections.find((s) => s.id === sectionId)?.nom_base || 'Non spécifiée'}</div>
              </div>
            </div>

            <table className="w-full border-collapse text-sm mb-4">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="text-left py-1.5 font-semibold text-slate-600">Article</th>
                  <th className="text-right py-1.5 font-semibold text-slate-600">Prix unitaire</th>
                  <th className="text-center py-1.5 font-semibold text-slate-600">Qté à commander</th>
                  <th className="text-center py-1.5 font-semibold text-slate-600 no-print">Date livraison prévue</th>
                  <th className="text-center py-1.5 font-semibold text-slate-600 hidden print:table-cell">Livraison prévue</th>
                  <th className="text-right py-1.5 font-semibold text-slate-600">Total ligne</th>
                </tr>
              </thead>
              <tbody>
                {group.lignes.map((l) => (
                  <tr key={l.article_id} className="border-b border-slate-100">
                    <td className="py-2 font-medium">{l.article_nom}</td>
                    <td className="py-2 text-right"><MontantAffiche montant={l.prix_unitaire} devise={l.devise} /></td>
                    <td className="py-2 text-center no-print">
                      <input
                        type="number" min="1" className="w-20 text-center text-sm border border-slate-200 rounded px-1 py-0.5"
                        value={quantites[l.article_id] ?? ''}
                        disabled={!!dejaGenere}
                        onChange={(e) => setQuantites((q) => ({ ...q, [l.article_id]: Math.max(1, Number(e.target.value) || 1) }))}
                      />
                    </td>
                    <td className="py-2 text-center hidden print:table-cell">{quantites[l.article_id]}</td>
                    <td className="py-2 text-center no-print">
                      <input
                        type="date" className="text-sm border border-slate-200 rounded px-1 py-0.5"
                        value={datesLivraison[l.article_id] || ''}
                        disabled={!!dejaGenere}
                        onChange={(e) => setDatesLivraison((d) => ({ ...d, [l.article_id]: e.target.value }))}
                      />
                    </td>
                    <td className="py-2 text-center hidden print:table-cell">{datesLivraison[l.article_id] ? new Date(datesLivraison[l.article_id]).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="py-2 text-right font-medium"><MontantAffiche montant={l.prix_unitaire * (Number(quantites[l.article_id]) || 0)} devise={l.devise} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="py-2 text-right text-sm font-semibold text-slate-600">Total commande</td>
                  <td className="py-2 text-right text-base font-bold text-marine-700"><MontantAffiche montant={totalUsd} devise="USD" /></td>
                </tr>
              </tfoot>
            </table>

            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-6">Émis par (Procurement Analyst)</div>
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
              Document généré par BoostDuka — {new Date().toLocaleString('fr-FR')}
            </div>
          </div>

          <div className="no-print bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3 flex-wrap">
            {!dejaGenere ? (
              <button className="btn-primary" disabled={!sectionId} onClick={handleConfirmer}>
                Confirmer et enregistrer le Bon de Commande
              </button>
            ) : (
              <span className="text-sm text-emeraude-700 font-medium">✓ Bon de commande {dejaGenere.reference} déjà enregistré le {new Date(dejaGenere.date).toLocaleDateString('fr-FR')}</span>
            )}
            <button className="btn-secondary" onClick={() => window.print()}>Imprimer / Exporter PDF</button>
            {message && <span className="text-xs text-emeraude-700">{message}</span>}
          </div>
          {!sectionId && !dejaGenere && (
            <div className="no-print text-xs text-or-700 mt-2">Sélectionnez une section demandeuse pour pouvoir enregistrer la commande.</div>
          )}
        </>
      )}
    </div>
  );
}
