import { useEffect, useMemo, useState } from 'react';
import { listCategories, listArticlesByCategorie, listSections, listFournisseurRows } from '../lib/dataSource';
import { listRFQs, saveRFQ, deleteRFQ, refFromRFQId } from '../lib/rfqStore';
import { exportToExcel } from '../lib/exportExcel';

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function AjoutLigne({ categories, onAdd }) {
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
        <label className="text-xs font-medium text-slate-500 mb-1 block">Article à inclure dans la demande</label>
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
          const categorie = categories.find((c) => c.id === article?.categorie_id);
          if (article) onAdd({ article, categorie });
          setArticleId('');
        }}
      >
        + Ajouter cet article
      </button>
    </div>
  );
}

function buildTemplateRows(lignes) {
  return lignes.map((l) => ({
    Article: l.article_nom,
    Qté: l.quantite_souhaitee,
    'Prix unitaire': '',
    Devise: 'USD',
    'Délai livraison (jours)': '',
    'Transport inclus': '',
    'Qté Min-Stock': '',
    'Validité offre': '',
  }));
}

function DocumentPanel({ rfq, onMarquerEnvoyee }) {
  const [fournisseurId, setFournisseurId] = useState(rfq.fournisseurs?.[0]?.fournisseur_id || '');
  const fournisseur = rfq.fournisseurs.find((f) => f.fournisseur_id === fournisseurId) || rfq.fournisseurs[0];

  if (!fournisseur) return null;

  return (
    <div>
      <div className="no-print flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Copie adressée à</label>
          <select className="input-field !w-auto min-w-[220px]" value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)}>
            {rfq.fournisseurs.map((f) => (<option key={f.fournisseur_id} value={f.fournisseur_id}>{f.nom}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            onClick={() => exportToExcel(
              [{ name: 'Devis à compléter', rows: buildTemplateRows(rfq.lignes) }],
              `${refFromRFQId(rfq.id)}_${slug(fournisseur.nom)}.xlsx`
            )}
          >
            Télécharger le modèle Excel
          </button>
          <button className="btn-primary" onClick={() => window.print()}>Imprimer / Exporter PDF</button>
          {rfq.statut === 'brouillon' && (
            <button className="btn-secondary" onClick={onMarquerEnvoyee}>Marquer comme envoyée</button>
          )}
        </div>
      </div>

      <div className="printable-area bg-white border border-slate-200 rounded-lg p-8">
        <div className="flex items-start justify-between border-b-2 border-marine-700 pb-4 mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400">VISIBA Logistics Group</div>
            <h2 className="text-lg font-bold text-marine-700 mt-1">Demande de devis (RFQ)</h2>
            <div className="text-xs text-slate-500 mt-1">Réf. {refFromRFQId(rfq.id)}</div>
          </div>
          <div className="text-right">
            <span className={`badge ${rfq.statut === 'envoyee' ? 'bg-emeraude-50 text-emeraude-700' : 'bg-or-50 text-or-700'}`}>
              {rfq.statut === 'envoyee' ? 'ENVOYÉE' : 'BROUILLON'}
            </span>
            <div className="text-xs text-slate-500 mt-2">Émise le {new Date(rfq.created_at).toLocaleDateString('fr-FR')}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 text-sm">
          <div>
            <div className="text-xs text-slate-400">À l'attention de</div>
            <div className="font-medium">{fournisseur.nom}</div>
            <div className="text-xs text-slate-500">{fournisseur.email_contact || '—'} {fournisseur.telephone_contact ? `· ${fournisseur.telephone_contact}` : ''}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Section demandeuse</div>
            <div className="font-medium">{rfq.section_nom || 'Intersection Procurement'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Date limite de réponse souhaitée</div>
            <div className="font-medium">{rfq.date_limite_reponse ? new Date(rfq.date_limite_reponse).toLocaleDateString('fr-FR') : 'Non spécifiée'}</div>
          </div>
        </div>

        <table className="w-full border-collapse text-sm mb-4">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="text-left py-1.5 font-semibold text-slate-600">Article</th>
              <th className="text-left py-1.5 font-semibold text-slate-600">Description &amp; Spécification</th>
              <th className="text-center py-1.5 font-semibold text-slate-600">Unité</th>
              <th className="text-center py-1.5 font-semibold text-slate-600">Qté souhaitée</th>
              <th className="text-center py-1.5 font-semibold text-slate-600 border-l border-slate-200">Prix unitaire</th>
              <th className="text-center py-1.5 font-semibold text-slate-600">Devise</th>
              <th className="text-center py-1.5 font-semibold text-slate-600">Délai (j)</th>
              <th className="text-center py-1.5 font-semibold text-slate-600">Transport inclus</th>
              <th className="text-center py-1.5 font-semibold text-slate-600">Stock disponible</th>
              <th className="text-center py-1.5 font-semibold text-slate-600">Validité offre</th>
            </tr>
          </thead>
          <tbody>
            {rfq.lignes.map((l) => (
              <tr key={l.article_id} className="border-b border-slate-100">
                <td className="py-2 font-medium">{l.article_nom}</td>
                <td className="py-2 text-xs text-slate-500">{l.description_specification || '—'}</td>
                <td className="py-2 text-center">{l.unite_mesure}</td>
                <td className="py-2 text-center">{l.quantite_souhaitee}</td>
                <td className="py-2 border-l border-slate-200">&nbsp;</td>
                <td className="py-2">&nbsp;</td>
                <td className="py-2">&nbsp;</td>
                <td className="py-2">&nbsp;</td>
                <td className="py-2">&nbsp;</td>
                <td className="py-2">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-[11px] text-slate-400 mb-6">
          Colonnes vierges (Prix unitaire → Validité offre) à compléter par le fournisseur, à la main ou dans le
          modèle Excel joint — la réponse pourra ensuite être réimportée directement via le module « Import de devis ».
        </div>

        {rfq.notes && (
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Instructions complémentaires</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{rfq.notes}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-6">Demande émise par (Procurement Analyst)</div>
            <div className="border-b border-slate-300 pb-1 mb-1">&nbsp;</div>
            <div className="text-xs text-slate-400">Nom, signature, date</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-6">Réponse fournisseur (cachet / signature)</div>
            <div className="border-b border-slate-300 pb-1 mb-1">&nbsp;</div>
            <div className="text-xs text-slate-400">Nom, signature, date, cachet</div>
          </div>
        </div>

        <div className="mt-8 pt-3 border-t border-slate-100 text-[10px] text-slate-400 text-center">
          Document généré par BoostDuka — {new Date().toLocaleString('fr-FR')}
        </div>
      </div>
    </div>
  );
}

export default function DemandeDevis() {
  const [categories, setCategories] = useState([]);
  const [sections, setSections] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const [dateLimite, setDateLimite] = useState('');
  const [notes, setNotes] = useState('');
  const [lignes, setLignes] = useState([]);
  const [fournisseurIds, setFournisseurIds] = useState([]);
  const [fournisseurSearch, setFournisseurSearch] = useState('');
  const [savedRFQs, setSavedRFQs] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    listCategories().then(setCategories);
    listSections().then(setSections);
    listFournisseurRows({ statut: 'actif' }).then(setFournisseurs);
    setSavedRFQs(listRFQs());
  }, []);

  const categorieIdsDansDemande = useMemo(() => new Set(lignes.map((l) => l.categorie_id)), [lignes]);

  const fournisseursTries = useMemo(() => {
    const q = fournisseurSearch.trim().toLowerCase();
    let list = fournisseurs;
    if (q) list = list.filter((f) => f.nom.toLowerCase().includes(q) || f.province_nom.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      const aCouvre = a.categorie_ids.some((id) => categorieIdsDansDemande.has(id));
      const bCouvre = b.categorie_ids.some((id) => categorieIdsDansDemande.has(id));
      if (aCouvre !== bCouvre) return aCouvre ? -1 : 1;
      return b.score_fiabilite - a.score_fiabilite;
    });
  }, [fournisseurs, fournisseurSearch, categorieIdsDansDemande]);

  const activeRFQ = savedRFQs.find((r) => r.id === activeId);

  function handleAddLigne({ article, categorie }) {
    if (lignes.some((l) => l.article_id === article.id)) return;
    setLignes((prev) => [
      ...prev,
      {
        article_id: article.id,
        article_nom: article.nom_article,
        categorie_id: article.categorie_id,
        categorie_nom: categorie?.nom_categorie ?? '—',
        unite_mesure: article.unite_mesure,
        description_specification: article.description_specification,
        quantite_souhaitee: 1,
      },
    ]);
  }

  function updateQuantite(articleId, value) {
    setLignes((prev) => prev.map((l) => (l.article_id === articleId ? { ...l, quantite_souhaitee: Math.max(1, Number(value) || 1) } : l)));
  }

  function toggleFournisseur(id) {
    setFournisseurIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleReset() {
    setLignes([]);
    setFournisseurIds([]);
    setSectionId('');
    setDateLimite('');
    setNotes('');
  }

  function handleSave() {
    if (lignes.length === 0 || fournisseurIds.length === 0) return;
    const section = sections.find((s) => s.id === sectionId);
    const rfq = {
      id: crypto.randomUUID(),
      section_id: sectionId || null,
      section_nom: section?.nom_base || null,
      date_limite_reponse: dateLimite || null,
      notes,
      lignes,
      fournisseurs: fournisseurIds.map((id) => {
        const f = fournisseurs.find((x) => x.id === id);
        return { fournisseur_id: id, nom: f?.nom ?? '—', email_contact: f?.email_contact, telephone_contact: f?.telephone_contact };
      }),
      statut: 'brouillon',
    };
    saveRFQ(rfq);
    const all = listRFQs();
    setSavedRFQs(all);
    setActiveId(rfq.id);
    setSaveMessage(`Demande enregistrée (${lignes.length} article(s), ${fournisseurIds.length} fournisseur(s)).`);
    handleReset();
  }

  function handleMarquerEnvoyee() {
    if (!activeRFQ) return;
    saveRFQ({ ...activeRFQ, statut: 'envoyee' });
    setSavedRFQs(listRFQs());
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="no-print mb-5">
        <h1 className="text-xl font-semibold text-slate-800">Demande de devis (RFQ)</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Sélectionnez les articles à demander et les fournisseurs à consulter, puis générez le modèle Excel et le
          document imprimable à adresser à chacun. Une fois la réponse reçue, importez-la via « Import de devis »
          pour l'intégrer à la Synthèse comparative puis au CBA.
        </p>
      </div>

      {!activeId && (
        <div className="no-print">
          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Section demandeuse (optionnel)</label>
              <select className="input-field" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                <option value="">Non spécifiée</option>
                {sections.map((s) => (<option key={s.id} value={s.id}>{s.nom_base}</option>))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Date limite de réponse (optionnel)</label>
              <input type="date" className="input-field" value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} />
            </div>
          </div>

          <AjoutLigne categories={categories} onAdd={handleAddLigne} />

          {lignes.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="table-th">Article</th>
                    <th className="table-th">Catégorie</th>
                    <th className="table-th text-center">Qté souhaitée</th>
                    <th className="table-th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lignes.map((l) => (
                    <tr key={l.article_id}>
                      <td className="table-td font-medium">{l.article_nom}</td>
                      <td className="table-td text-slate-500">{l.categorie_nom}</td>
                      <td className="table-td text-center">
                        <input
                          type="number" min="1" className="w-20 text-center text-sm border border-slate-200 rounded px-1 py-0.5"
                          value={l.quantite_souhaitee} onChange={(e) => updateQuantite(l.article_id, e.target.value)}
                        />
                      </td>
                      <td className="table-td text-right">
                        <button className="text-xs text-red-600 hover:underline" onClick={() => setLignes((prev) => prev.filter((x) => x.article_id !== l.article_id))}>Retirer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Fournisseurs à consulter ({fournisseurIds.length} sélectionné(s))</label>
              <input
                className="input-field !w-auto max-w-xs" placeholder="Rechercher un fournisseur..."
                value={fournisseurSearch} onChange={(e) => setFournisseurSearch(e.target.value)}
              />
            </div>
            {lignes.length > 0 && (
              <div className="text-[11px] text-slate-400 mb-2">Les fournisseurs couvrant une catégorie demandée apparaissent en premier.</div>
            )}
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-md">
              {fournisseursTries.map((f) => {
                const couvre = f.categorie_ids.some((id) => categorieIdsDansDemande.has(id));
                return (
                  <label key={f.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={fournisseurIds.includes(f.id)} onChange={() => toggleFournisseur(f.id)} />
                    <span className="font-medium text-slate-800">{f.nom}</span>
                    <span className="text-xs text-slate-400">{f.province_nom}</span>
                    {couvre && <span className="badge bg-emeraude-50 text-emeraude-700 text-[10px] ml-auto">Couvre une catégorie demandée</span>}
                  </label>
                );
              })}
              {fournisseursTries.length === 0 && <div className="px-3 py-4 text-sm text-slate-400 text-center">Aucun fournisseur trouvé.</div>}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Instructions complémentaires (optionnel)</label>
            <textarea className="input-field min-h-[70px]" placeholder="ex: merci d'indiquer le délai de livraison à Kalemie..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 flex items-center gap-3">
            <button className="btn-primary" disabled={lignes.length === 0 || fournisseurIds.length === 0} onClick={handleSave}>
              Enregistrer et générer les documents
            </button>
            {saveMessage && <span className="text-xs text-emeraude-700">{saveMessage}</span>}
          </div>
        </div>
      )}

      {activeRFQ && (
        <div className="mb-6">
          <button className="no-print btn-secondary mb-3" onClick={() => setActiveId('')}>← Nouvelle demande</button>
          <DocumentPanel rfq={activeRFQ} onMarquerEnvoyee={handleMarquerEnvoyee} />
        </div>
      )}

      {!activeId && savedRFQs.length > 0 && (
        <div className="no-print bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-sm font-medium text-slate-700 mb-2">Demandes enregistrées</div>
          <ul className="divide-y divide-slate-100">
            {savedRFQs.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between text-sm gap-3">
                <div className="min-w-0">
                  <span className="font-medium">{refFromRFQId(r.id)}</span>
                  <span className="text-slate-500 ml-2">{(r.lignes || []).length} article(s) · {(r.fournisseurs || []).length} fournisseur(s)</span>
                  <span className="text-slate-400 ml-2 text-xs">{new Date(r.created_at).toLocaleString('fr-FR')}</span>
                  <span className={`badge ml-2 text-[10px] ${r.statut === 'envoyee' ? 'bg-emeraude-50 text-emeraude-700' : 'bg-or-50 text-or-700'}`}>
                    {r.statut === 'envoyee' ? 'Envoyée' : 'Brouillon'}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button className="text-xs text-marine-700 hover:underline" onClick={() => setActiveId(r.id)}>Ouvrir</button>
                  <button
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => { deleteRFQ(r.id); setSavedRFQs(listRFQs()); }}
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
