import { useEffect, useMemo, useState } from 'react';
import { listCommandesEnAttente, listCommandesRecues, commitReceptionCommande } from '../lib/dataSource';
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

function LigneEnAttente({ commande, onConfirmed }) {
  const [dateReelle, setDateReelle] = useState(todayISO());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const enRetardPrevu = commande.date_livraison_prevue && new Date(commande.date_livraison_prevue) < new Date() && !commande.date_livraison_reelle;

  async function handleConfirmer() {
    setSubmitting(true);
    setError('');
    try {
      const ecart = joursEcart(commande.date_livraison_prevue, dateReelle);
      await commitReceptionCommande(commande.id, {
        date_livraison_reelle: dateReelle,
        statut: ecart != null && ecart > 0 ? 'livree_en_retard' : 'livree_a_temps',
        ecart_jours: ecart,
      });
      onConfirmed();
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
      await commitReceptionCommande(commande.id, { statut: 'annulee' });
      onConfirmed();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <tr className={enRetardPrevu ? 'bg-red-50/40' : ''}>
      <td className="table-td font-medium text-slate-800">{commande.article_nom}</td>
      <td className="table-td text-slate-500">{commande.fournisseur_nom}</td>
      <td className="table-td text-slate-500">{commande.section_nom}</td>
      <td className="table-td text-center">{commande.quantite}</td>
      <td className="table-td text-right"><MontantAffiche montant={commande.prix_unitaire * commande.quantite} devise={commande.devise} /></td>
      <td className="table-td text-center">
        {commande.date_livraison_prevue ? new Date(commande.date_livraison_prevue).toLocaleDateString('fr-FR') : '—'}
        {enRetardPrevu && <div className="text-[10px] text-red-600 font-medium">En retard</div>}
      </td>
      <td className="table-td">
        <input type="date" className="text-sm border border-slate-200 rounded px-1 py-1" value={dateReelle} onChange={(e) => setDateReelle(e.target.value)} />
      </td>
      <td className="table-td text-right">
        <div className="flex items-center justify-end gap-2">
          <button className="btn-primary !py-1 !px-2 text-xs" disabled={submitting} onClick={handleConfirmer}>Confirmer la réception</button>
          <button className="text-xs text-red-600 hover:underline" disabled={submitting} onClick={handleAnnuler}>Annuler</button>
        </div>
        {error && <div className="text-[10px] text-red-600 mt-1">{error}</div>}
      </td>
    </tr>
  );
}

export default function Reception() {
  const [enAttente, setEnAttente] = useState([]);
  const [recues, setRecues] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const [pending, done] = await Promise.all([listCommandesEnAttente(), listCommandesRecues()]);
    setEnAttente(pending);
    setRecues(done);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  const nbEnRetard = useMemo(
    () => enAttente.filter((c) => c.date_livraison_prevue && new Date(c.date_livraison_prevue) < new Date()).length,
    [enAttente]
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-800">Réception</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Dernière étape du cycle : confirmez la livraison réelle de chaque bon de commande. Chaque confirmation met
          à jour en direct les KPIs Livraison du Dashboard (lead time, taux à temps, annulations) — le processus
          complet, de la demande interne à la réception, reste ainsi mesurable de bout en bout.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5 max-w-xl">
        <div className="kpi-card">
          <div className="text-2xl font-bold text-slate-800">{enAttente.length}</div>
          <div className="text-xs text-slate-500">En attente de réception</div>
        </div>
        <div className="kpi-card">
          <div className={`text-2xl font-bold ${nbEnRetard > 0 ? 'text-red-600' : 'text-slate-800'}`}>{nbEnRetard}</div>
          <div className="text-xs text-slate-500">Déjà en retard</div>
        </div>
        <div className="kpi-card">
          <div className="text-2xl font-bold text-slate-800">{recues.length}</div>
          <div className="text-xs text-slate-500">Réceptions traitées (total)</div>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-400 py-10 text-center">Chargement…</div>}

      {!loading && (
        <>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">
              Commandes en attente de réception ({enAttente.length})
            </div>
            {enAttente.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-8">Aucune commande en attente — tous les bons de commande émis ont été réceptionnés.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="table-th">Article</th>
                      <th className="table-th">Fournisseur</th>
                      <th className="table-th">Section</th>
                      <th className="table-th text-center">Qté</th>
                      <th className="table-th text-right">Montant</th>
                      <th className="table-th text-center">Livraison prévue</th>
                      <th className="table-th">Date réelle</th>
                      <th className="table-th text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {enAttente.map((c) => (
                      <LigneEnAttente key={c.id} commande={c} onConfirmed={refresh} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">
              Réceptions récentes
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
    </div>
  );
}
