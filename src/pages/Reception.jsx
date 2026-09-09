import { useEffect, useMemo, useState } from 'react';
import { listCommandesEnAttente, listCommandesRecues, commitReceptionCommande } from '../lib/dataSource';
import { listGRNs, saveGRN, refFromGRN } from '../lib/grnStore';
import { convertPourAffichage, formatMoney } from '../lib/currency';
import { useDevisePreference } from '../lib/DevisePreferenceContext';

function MontantAffiche({ montant, devise }) {
  const { devisePrincipale, deviseSecondaire } = useDevisePreference();
  const { principal, principalCode, secondaire, secondaireCode } = convertPourAffichage(montant, devise, devisePrincipale, deviseSecondaire);
  return (
    <>
      {formatMoney(principal, principalCode)}
      {secondaire != null && <div className="text-[10px] text-slate-400">≈ {formatMoney(secondaire, secondaireCode)}</div>}
    </>
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function joursEcart(prevue, reelle) {
  if (!prevue || !reelle) return null;
  return Math.round((new Date(reelle) - new Date(prevue)) / (1000 * 60 * 60 * 24));
}

const STATUT_BADGE = {
  livree_a_temps: { label: 'Livrée à temps', cls: 'bg-emeraude-50 text-emeraude-700' },
  livree_en_retard: { label: 'Livrée en retard', cls: 'bg-or-50 text-or-700' },
  annulee: { label: 'Annulée', cls: 'bg-red-50 text-red-700' },
};

// Regroupe les commandes en attente par PO — la reception se fait sur base
// du bon de commande, pas ligne par ligne au hasard : les articles et
// quantités affichés sont ceux du PO d'origine, à confirmer ou corriger.
function groupByPO(commandes) {
  const map = new Map();
  commandes.forEach((c) => {
    const key = c.po_reference || `NOPO-${c.id}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        po_reference: c.po_reference || null,
        sequence: c.sequence || null,
        po_suffixe: c.po_suffixe || null,
        fournisseur_nom: c.fournisseur_nom,
        section_nom: c.section_nom,
        lignes: [],
      });
    }
    map.get(key).lignes.push(c);
  });
  return [...map.values()].sort((a, b) => {
    const da = a.lignes[0]?.date_livraison_prevue || a.lignes[0]?.date_po;
    const db = b.lignes[0]?.date_livraison_prevue || b.lignes[0]?.date_po;
    return new Date(da) - new Date(db);
  });
}

function GroupePO({ groupe, onReceptionne }) {
  const [dateReelle, setDateReelle] = useState(todayISO());
  const [quantitesRecues, setQuantitesRecues] = useState(() => Object.fromEntries(groupe.lignes.map((l) => [l.id, l.quantite])));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const enRetardPrevu = groupe.lignes.some((l) => l.date_livraison_prevue && new Date(l.date_livraison_prevue) < new Date());

  async function handleConfirmer() {
    setSubmitting(true);
    setError('');
    try {
      for (const l of groupe.lignes) {
        const ecart = joursEcart(l.date_livraison_prevue, dateReelle);
        await commitReceptionCommande(l.id, {
          date_livraison_reelle: dateReelle,
          statut: ecart != null && ecart > 0 ? 'livree_en_retard' : 'livree_a_temps',
          ecart_jours: ecart,
        });
      }
      const grn = {
        id: crypto.randomUUID(),
        sequence: groupe.sequence,
        suffixe_lettre: groupe.po_suffixe,
        po_reference: groupe.po_reference,
        fournisseur_nom: groupe.fournisseur_nom,
        section_nom: groupe.section_nom,
        date_reception: dateReelle,
        lignes: groupe.lignes.map((l) => ({
          article_nom: l.article_nom,
          quantite_commandee: l.quantite,
          quantite_recue: Number(quantitesRecues[l.id]) || 0,
          prix_unitaire: l.prix_unitaire,
          devise: l.devise,
        })),
      };
      saveGRN(grn);
      onReceptionne(grn.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAnnuler() {
    setSubmitting(true);
    setError('');
    try {
      for (const l of groupe.lignes) {
        await commitReceptionCommande(l.id, { statut: 'annulee' });
      }
      onReceptionne(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${enRetardPrevu ? 'border-red-200' : 'border-slate-200'}`}>
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${enRetardPrevu ? 'bg-red-50/60 border-red-100' : 'bg-slate-50 border-slate-200'}`}>
        <div className="text-sm">
          <span className="font-semibold text-slate-800">{groupe.po_reference || 'Sans référence PO (donnée antérieure)'}</span>
          <span className="text-slate-500 ml-2">{groupe.fournisseur_nom} · {groupe.section_nom}</span>
          {enRetardPrevu && <span className="badge bg-red-50 text-red-700 ml-2 text-[10px]">En retard</span>}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Date de réception</label>
          <input type="date" className="text-sm border border-slate-200 rounded px-1 py-1" value={dateReelle} onChange={(e) => setDateReelle(e.target.value)} />
        </div>
      </div>
      <table className="w-full border-collapse">
        <thead className="bg-white border-b border-slate-100">
          <tr>
            <th className="table-th">Article</th>
            <th className="table-th text-center">Qté commandée</th>
            <th className="table-th text-center">Qté reçue</th>
            <th className="table-th text-right">Montant</th>
            <th className="table-th text-center">Livraison prévue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {groupe.lignes.map((l) => (
            <tr key={l.id}>
              <td className="table-td font-medium text-slate-800">{l.article_nom}</td>
              <td className="table-td text-center text-slate-500">{l.quantite}</td>
              <td className="table-td text-center">
                <input
                  type="number" min="0" className="w-20 text-center text-sm border border-slate-200 rounded px-1 py-0.5"
                  value={quantitesRecues[l.id]}
                  onChange={(e) => setQuantitesRecues((q) => ({ ...q, [l.id]: e.target.value }))}
                />
                {Number(quantitesRecues[l.id]) !== l.quantite && (
                  <div className="text-[10px] text-or-700 mt-0.5">≠ commandé</div>
                )}
              </td>
              <td className="table-td text-right"><MontantAffiche montant={l.prix_unitaire * l.quantite} devise={l.devise} /></td>
              <td className="table-td text-center">
                {l.date_livraison_prevue ? new Date(l.date_livraison_prevue).toLocaleDateString('fr-FR') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white">
        <button className="btn-primary !py-1.5 text-xs" disabled={submitting} onClick={handleConfirmer}>
          Confirmer la réception du PO — génère le GRN
        </button>
        <button className="text-xs text-red-600 hover:underline" disabled={submitting} onClick={handleAnnuler}>Annuler le PO</button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

function GRNPrintable({ grn }) {
  const totalUsd = grn.lignes.reduce((s, l) => s + l.prix_unitaire * l.quantite_recue, 0);
  return (
    <div className="printable-area bg-white border border-slate-200 rounded-lg p-8">
      <div className="flex items-start justify-between border-b-2 border-marine-700 pb-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">VISIBA Logistics Group</div>
          <h2 className="text-lg font-bold text-marine-700 mt-1">Bon de Réception (GRN)</h2>
          <div className="text-xs text-slate-500 mt-1">Réf. {refFromGRN(grn)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">PO d'origine : {grn.po_reference || '—'}</div>
        </div>
        <div className="text-right">
          <span className="badge bg-emeraude-50 text-emeraude-700">RÉCEPTIONNÉ</span>
          <div className="text-xs text-slate-500 mt-2">Reçu le {new Date(grn.date_reception).toLocaleDateString('fr-FR')}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <div className="text-xs text-slate-400">Fournisseur</div>
          <div className="font-medium">{grn.fournisseur_nom}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Section demandeuse</div>
          <div className="font-medium">{grn.section_nom}</div>
        </div>
      </div>

      <table className="w-full border-collapse text-sm mb-4">
        <thead>
          <tr className="border-b border-slate-300">
            <th className="text-left py-1.5 font-semibold text-slate-600">Article</th>
            <th className="text-center py-1.5 font-semibold text-slate-600">Qté commandée</th>
            <th className="text-center py-1.5 font-semibold text-slate-600">Qté reçue</th>
            <th className="text-center py-1.5 font-semibold text-slate-600">Écart</th>
            <th className="text-right py-1.5 font-semibold text-slate-600">Montant reçu</th>
          </tr>
        </thead>
        <tbody>
          {grn.lignes.map((l, i) => {
            const ecart = l.quantite_recue - l.quantite_commandee;
            return (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 font-medium">{l.article_nom}</td>
                <td className="py-2 text-center">{l.quantite_commandee}</td>
                <td className="py-2 text-center">{l.quantite_recue}</td>
                <td className={`py-2 text-center ${ecart !== 0 ? 'text-or-700 font-medium' : 'text-slate-400'}`}>{ecart > 0 ? `+${ecart}` : ecart}</td>
                <td className="py-2 text-right"><MontantAffiche montant={l.prix_unitaire * l.quantite_recue} devise={l.devise} /></td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="py-2 text-right text-sm font-semibold text-slate-600">Total reçu</td>
            <td className="py-2 text-right text-base font-bold text-marine-700"><MontantAffiche montant={totalUsd} devise="USD" /></td>
          </tr>
        </tfoot>
      </table>

      <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-6">Réceptionné par (Section demandeuse)</div>
          <div className="border-b border-slate-300 pb-1 mb-1">&nbsp;</div>
          <div className="text-xs text-slate-400">Nom, signature, date</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-6">Vérifié par (Procurement / Logistique)</div>
          <div className="border-b border-slate-300 pb-1 mb-1">&nbsp;</div>
          <div className="text-xs text-slate-400">Nom, signature, date</div>
        </div>
      </div>

      <div className="mt-8 pt-3 border-t border-slate-100 text-[10px] text-slate-400 text-center">
        Document généré par BoostDuka — {new Date().toLocaleString('fr-FR')}
      </div>
    </div>
  );
}

export default function Reception() {
  const [enAttente, setEnAttente] = useState([]);
  const [recues, setRecues] = useState([]);
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGrnId, setActiveGrnId] = useState('');

  async function refresh() {
    setLoading(true);
    const [pending, done] = await Promise.all([listCommandesEnAttente(), listCommandesRecues()]);
    setEnAttente(pending);
    setRecues(done);
    setGrns(listGRNs());
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  const groupes = useMemo(() => groupByPO(enAttente), [enAttente]);
  const activeGrn = grns.find((g) => g.id === activeGrnId);

  const nbEnRetard = useMemo(
    () => enAttente.filter((c) => c.date_livraison_prevue && new Date(c.date_livraison_prevue) < new Date()).length,
    [enAttente]
  );

  function handleReceptionne(grnId) {
    refresh();
    if (grnId) setActiveGrnId(grnId);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="no-print mb-5">
        <h1 className="text-xl font-semibold text-slate-800">Réception</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Dernière étape du cycle : la réception se fait sur base du Bon de Commande (PO) validé — articles et
          quantités affichés sont ceux effectivement commandés. Chaque confirmation met à jour en direct les KPIs
          Livraison du Dashboard et génère un Bon de Réception (GRN) prêt pour signature et archivage.
        </p>
      </div>

      {activeGrn && (
        <div className="mb-6">
          <div className="no-print flex items-center justify-between mb-3">
            <button className="btn-secondary" onClick={() => setActiveGrnId('')}>← Retour à la réception</button>
            <button className="btn-primary" onClick={() => window.print()}>Imprimer / Exporter PDF</button>
          </div>
          <GRNPrintable grn={activeGrn} />
        </div>
      )}

      {!activeGrn && (
        <>
          <div className="no-print grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5 max-w-xl">
            <div className="kpi-card">
              <div className="text-2xl font-bold text-slate-800">{groupes.length}</div>
              <div className="text-xs text-slate-500">PO en attente de réception</div>
            </div>
            <div className="kpi-card">
              <div className={`text-2xl font-bold ${nbEnRetard > 0 ? 'text-red-600' : 'text-slate-800'}`}>{nbEnRetard}</div>
              <div className="text-xs text-slate-500">Lignes déjà en retard</div>
            </div>
            <div className="kpi-card">
              <div className="text-2xl font-bold text-slate-800">{grns.length}</div>
              <div className="text-xs text-slate-500">GRN archivés</div>
            </div>
          </div>

          {loading && <div className="text-sm text-slate-400 py-10 text-center">Chargement…</div>}

          {!loading && (
            <>
              <div className="mb-6">
                <div className="text-sm font-medium text-slate-700 mb-2">Bons de commande en attente de réception ({groupes.length})</div>
                {groupes.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-lg text-sm text-slate-400 text-center py-8">
                    Aucun PO en attente — tous les bons de commande émis ont été réceptionnés.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {groupes.map((g) => (
                      <GroupePO key={g.key} groupe={g} onReceptionne={handleReceptionne} />
                    ))}
                  </div>
                )}
              </div>

              <div className="no-print bg-white border border-slate-200 rounded-lg overflow-hidden mb-6">
                <div className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">
                  Bons de réception (GRN) archivés
                  <span className="text-xs font-normal text-slate-400 ml-2">{grns.length} au total</span>
                </div>
                {grns.length === 0 ? (
                  <div className="text-sm text-slate-400 text-center py-8">Aucun GRN généré pour l'instant.</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {grns.slice(0, 20).map((g) => (
                      <li key={g.id} className="py-2 px-4 flex items-center justify-between text-sm gap-3">
                        <div className="min-w-0">
                          <span className="font-medium">{refFromGRN(g)}</span>
                          <span className="text-slate-500 ml-2">{g.fournisseur_nom} · {g.section_nom}</span>
                          <span className="text-slate-400 ml-2 text-xs">{new Date(g.date_reception).toLocaleDateString('fr-FR')}</span>
                          {g.po_reference && <span className="text-slate-400 ml-2 text-xs">PO : {g.po_reference}</span>}
                        </div>
                        <button className="text-xs text-marine-700 hover:underline shrink-0" onClick={() => setActiveGrnId(g.id)}>Voir / Imprimer</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="no-print bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">
                  Réceptions récentes (historique commandes)
                  <span className="text-xs font-normal text-slate-400 ml-2">{recues.length} au total — 30 plus récentes affichées</span>
                </div>
                {recues.length === 0 ? (
                  <div className="text-sm text-slate-400 text-center py-8">Aucune réception traitée pour l'instant.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="table-th">Article</th>
                          <th className="table-th">Fournisseur</th>
                          <th className="table-th">Section</th>
                          <th className="table-th text-center">Livraison prévue</th>
                          <th className="table-th text-center">Livraison réelle</th>
                          <th className="table-th text-center">Écart</th>
                          <th className="table-th text-center">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recues.slice(0, 30).map((c) => (
                          <tr key={c.id}>
                            <td className="table-td font-medium text-slate-800">{c.article_nom}</td>
                            <td className="table-td text-slate-500">{c.fournisseur_nom}</td>
                            <td className="table-td text-slate-500">{c.section_nom}</td>
                            <td className="table-td text-center">{c.date_livraison_prevue ? new Date(c.date_livraison_prevue).toLocaleDateString('fr-FR') : '—'}</td>
                            <td className="table-td text-center">{c.date_livraison_reelle ? new Date(c.date_livraison_reelle).toLocaleDateString('fr-FR') : '—'}</td>
                            <td className="table-td text-center">{c.ecart_jours != null ? `${c.ecart_jours > 0 ? '+' : ''}${c.ecart_jours} j` : '—'}</td>
                            <td className="table-td text-center">
                              <span className={`badge ${STATUT_BADGE[c.statut]?.cls ?? 'bg-slate-100 text-slate-500'}`}>
                                {STATUT_BADGE[c.statut]?.label ?? c.statut}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
