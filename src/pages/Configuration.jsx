import { useEffect, useState } from 'react';
import {
  listCategories, commitNouvelleCategorie, commitCategoriePatch,
  commitSupprimerCategorie, listArticlesByCategorie, commitNouvelArticle,
  commitArticlePatch, commitSupprimerArticle,
} from '../lib/dataSource';
import { listCurrencies, DEVISES_PRINCIPALES } from '../lib/currency';
import { useDevisePreference } from '../lib/DevisePreferenceContext';
import { usePowerBiLink } from '../lib/PowerBiLinkContext';

function DeviseSection() {
  const { devisePrincipale, setDevisePrincipale, deviseSecondaire, setDeviseSecondaire } = useDevisePreference();
  const currencies = listCurrencies();
  const principales = currencies.filter((c) => DEVISES_PRINCIPALES.includes(c.code));
  const secondaires = currencies.filter((c) => c.code !== devisePrincipale);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 mb-5">
      <h2 className="text-sm font-semibold text-slate-800 mb-1">Devise d'affichage</h2>
      <p className="text-xs text-slate-500 mb-4">
        Choisissez la devise dans laquelle les montants sont affichés dans toute l'application (Liste de Prix,
        Synthèse comparative, CBA), selon le pays/contexte de votre mission. Vous pouvez aussi afficher une
        seconde devise de conversion en complément.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Devise principale (toujours affichée)</label>
          <select className="input-field" value={devisePrincipale} onChange={(e) => setDevisePrincipale(e.target.value)}>
            {principales.map((c) => (<option key={c.code} value={c.code}>{c.code} — {c.label}</option>))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Devise de conversion (optionnelle)</label>
          <select
            className="input-field"
            value={deviseSecondaire || ''}
            onChange={(e) => setDeviseSecondaire(e.target.value || null)}
          >
            <option value="">Aucune (devise unique)</option>
            {secondaires.map((c) => (<option key={c.code} value={c.code}>{c.code} — {c.label}</option>))}
          </select>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mt-3">
        Taux de référence fixes (non temps réel — voir <code className="bg-slate-100 px-1 py-0.5 rounded">src/lib/currency.js</code>).
        Le scoring de la Synthèse comparative reste calculé en USD en interne pour une comparaison stable, indépendamment de cette préférence d'affichage.
      </p>
    </div>
  );
}

function isLienPowerBIValide(lien) {
  if (!lien) return true; // champ vide autorisé (retire le lien)
  try {
    const u = new URL(lien);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function PowerBiLinkSection() {
  const { lienPowerBI, setLienPowerBI } = usePowerBiLink();
  const [valeur, setValeur] = useState(lienPowerBI);
  const [message, setMessage] = useState('');

  const valide = isLienPowerBIValide(valeur.trim());

  function handleSave() {
    if (!valide) return;
    setLienPowerBI(valeur.trim());
    setMessage(valeur.trim() ? 'Lien enregistré — visible sur Export Power BI.' : 'Lien retiré.');
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 mb-5">
      <h2 className="text-sm font-semibold text-slate-800 mb-1">Rapport Power BI en ligne</h2>
      <p className="text-xs text-slate-500 mb-4">
        Une fois votre rapport publié en <strong>« Publier sur le web (public) »</strong> depuis Power BI Desktop
        (lien public, sans compte requis pour le visiteur — voir <code className="bg-slate-100 px-1 py-0.5 rounded">supabase/modele_donnees_PBI.md</code> section 7),
        collez son URL ici. Elle apparaîtra comme lien direct sur le module Export Power BI. Ne jamais utiliser
        « Publier sur le web » sur un jeu de données réel/confidentiel — ce mode rend le rapport public sur internet ;
        le dataset de ce portfolio est entièrement fictif.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
        <input
          className="input-field"
          placeholder="https://app.powerbi.com/view?r=..."
          value={valeur}
          onChange={(e) => { setValeur(e.target.value); setMessage(''); }}
        />
        <button className="btn-primary shrink-0" disabled={!valide} onClick={handleSave}>Enregistrer</button>
      </div>
      {!valide && <p className="text-xs text-red-600 mt-2">Le lien doit être une URL https:// valide.</p>}
      {message && <p className="text-xs text-emeraude-700 mt-2">{message}</p>}
    </div>
  );
}

function NouvelleCategorieForm({ onCancel, onCreated }) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nom.trim()) {
      setError('Le nom de la catégorie est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await commitNouvelleCategorie(nom.trim(), description.trim());
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-slate-200 rounded-lg p-4 mb-4 space-y-3 bg-slate-50">
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Nom de la catégorie *</label>
        <input className="input-field" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex: Équipement informatique" />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Description (optionnel)</label>
        <input className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex: Ordinateurs, imprimantes, accessoires réseau" />
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement…' : 'Créer la catégorie'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

function CategorieRow({ categorie, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState(categorie.nom_categorie);
  const [description, setDescription] = useState(categorie.description || '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleSave() {
    setSaving(true);
    try {
      await commitCategoriePatch(categorie.id, { nom_categorie: nom.trim(), description: description.trim() });
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleteError('');
    try {
      await commitSupprimerCategorie(categorie.id);
      onChanged();
    } catch (err) {
      // Garde confirmDelete=true : le message d'erreur ne se rend que dans
      // cette branche du composant, sinon il disparaitrait aussitot affiche.
      setDeleteError(err.message);
    }
  }

  if (editing) {
    return (
      <tr className="bg-marine-50/40">
        <td className="table-td" colSpan={3}>
          <div className="flex flex-col sm:flex-row gap-2 py-1">
            <input className="input-field" value={nom} onChange={(e) => setNom(e.target.value)} />
            <input className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
            <div className="flex gap-2 shrink-0">
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '…' : 'Enregistrer'}</button>
              <button className="btn-secondary" onClick={() => setEditing(false)}>Annuler</button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="table-td font-medium text-slate-800">{categorie.nom_categorie}</td>
      <td className="table-td text-slate-500">{categorie.description || '—'}</td>
      <td className="table-td text-right">
        {!confirmDelete ? (
          <div className="flex gap-3 justify-end">
            <button className="text-xs text-marine-700 hover:underline" onClick={() => setEditing(true)}>Modifier</button>
            <button className="text-xs text-red-600 hover:underline" onClick={() => { setConfirmDelete(true); setDeleteError(''); }}>Supprimer</button>
          </div>
        ) : (
          <div className="text-right">
            <div className="flex gap-2 justify-end mb-1">
              <button className="btn-secondary !text-red-700 !border-red-300 !py-1 !px-2 text-xs" onClick={handleDelete}>Confirmer</button>
              <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(false)}>Annuler</button>
            </div>
            {deleteError && <p className="text-[11px] text-red-600 max-w-xs ml-auto">{deleteError}</p>}
          </div>
        )}
      </td>
    </tr>
  );
}

function NouvelArticleForm({ categorieId, onCancel, onCreated }) {
  const [nom, setNom] = useState('');
  const [unite, setUnite] = useState('unite');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nom.trim() || !unite.trim()) {
      setError("Le nom et l'unité de mesure sont obligatoires.");
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await commitNouvelArticle(categorieId, nom.trim(), unite.trim(), description.trim());
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-slate-200 rounded-lg p-4 mb-4 space-y-3 bg-slate-50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Nom de l'article *</label>
          <input className="input-field" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex: Onduleur 1500VA" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Unité de mesure *</label>
          <input className="input-field" value={unite} onChange={(e) => setUnite(e.target.value)} placeholder="ex: unite, boite, carton, litre" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Description & Spécification</label>
        <textarea
          className="input-field min-h-[70px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tous les détails utiles pour identifier précisément l'article sans ambiguïté : marque, norme, dimensions, couleur, compatibilité..."
        />
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement…' : "Créer l'article"}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

function ArticleRow({ article, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState(article.nom_article);
  const [unite, setUnite] = useState(article.unite_mesure);
  const [description, setDescription] = useState(article.description_specification || '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleSave() {
    setSaving(true);
    try {
      await commitArticlePatch(article.id, {
        nom_article: nom.trim(),
        unite_mesure: unite.trim(),
        description_specification: description.trim() || null,
      });
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleteError('');
    try {
      await commitSupprimerArticle(article.id);
      onChanged();
    } catch (err) {
      setDeleteError(err.message);
    }
  }

  if (editing) {
    return (
      <tr className="bg-marine-50/40">
        <td className="table-td" colSpan={4}>
          <div className="flex flex-col gap-2 py-1">
            <div className="flex flex-col sm:flex-row gap-2">
              <input className="input-field" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" />
              <input className="input-field sm:max-w-[140px]" value={unite} onChange={(e) => setUnite(e.target.value)} placeholder="Unité" />
            </div>
            <textarea className="input-field min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description & Spécification" />
            <div className="flex gap-2">
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '…' : 'Enregistrer'}</button>
              <button className="btn-secondary" onClick={() => setEditing(false)}>Annuler</button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="table-td font-medium text-slate-800">{article.nom_article}</td>
      <td className="table-td text-slate-500">{article.unite_mesure}</td>
      <td className="table-td text-slate-500 text-xs max-w-xs">{article.description_specification || '—'}</td>
      <td className="table-td text-right">
        {!confirmDelete ? (
          <div className="flex gap-3 justify-end">
            <button className="text-xs text-marine-700 hover:underline" onClick={() => setEditing(true)}>Modifier</button>
            <button className="text-xs text-red-600 hover:underline" onClick={() => { setConfirmDelete(true); setDeleteError(''); }}>Supprimer</button>
          </div>
        ) : (
          <div className="text-right">
            <div className="flex gap-2 justify-end mb-1">
              <button className="btn-secondary !text-red-700 !border-red-300 !py-1 !px-2 text-xs" onClick={handleDelete}>Confirmer</button>
              <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(false)}>Annuler</button>
            </div>
            {deleteError && <p className="text-[11px] text-red-600 max-w-xs ml-auto">{deleteError}</p>}
          </div>
        )}
      </td>
    </tr>
  );
}

function ArticlesSection({ categories }) {
  const [categorieId, setCategorieId] = useState('');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!categorieId) {
      setArticles([]);
      return;
    }
    setLoading(true);
    listArticlesByCategorie(Number(categorieId))
      .then((a) => setArticles([...a].sort((x, y) => x.nom_article.localeCompare(y.nom_article))))
      .finally(() => setLoading(false));
  }, [categorieId, refreshKey]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 mt-5">
      <div className="flex items-start justify-between mb-1 gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-800">Articles du catalogue</h2>
        <button className="btn-secondary" onClick={() => setShowNewForm((v) => !v)} disabled={!categorieId}>
          {showNewForm ? 'Fermer' : '+ Nouvel article'}
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Fournissez tous les détails possibles (marque, norme, dimensions...) dans « Description &amp; Spécification »
        pour identifier chaque article sans ambiguïté lors du choix (Liste de Prix, Import de devis, Synthèse comparative).
        Un article déjà utilisé par un devis, une commande ou une synthèse comparative ne peut pas être supprimé.
      </p>

      <div className="mb-4 max-w-sm">
        <label className="text-xs font-medium text-slate-500 mb-1 block">Catégorie</label>
        <select className="input-field" value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
          <option value="">Sélectionner une catégorie</option>
          {categories.map((c) => (<option key={c.id} value={c.id}>{c.nom_categorie}</option>))}
        </select>
      </div>

      {showNewForm && categorieId && (
        <NouvelArticleForm
          categorieId={Number(categorieId)}
          onCancel={() => setShowNewForm(false)}
          onCreated={() => { setShowNewForm(false); setRefreshKey((k) => k + 1); }}
        />
      )}

      {categorieId && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-th">Nom</th>
                <th className="table-th">Unité</th>
                <th className="table-th">Description & Spécification</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td className="table-td text-slate-400" colSpan={4}>Chargement…</td></tr>}
              {!loading && articles.length === 0 && (
                <tr><td className="table-td text-slate-400" colSpan={4}>Aucun article dans cette catégorie.</td></tr>
              )}
              {!loading && articles.map((a) => (
                <ArticleRow key={a.id} article={a} onChanged={() => setRefreshKey((k) => k + 1)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Configuration() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    listCategories()
      .then((c) => setCategories([...c].sort((a, b) => a.nom_categorie.localeCompare(b.nom_categorie))))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-800">Configuration</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Paramétrez l'outil selon votre contexte avant de l'utiliser. Cette V1 couvre les catégories d'achats, le
          catalogue d'articles et la devise d'affichage — d'autres référentiels (provinces, sections, conditions
          de paiement...) pourront suivre selon vos besoins.
        </p>
      </div>

      <DeviseSection />

      <PowerBiLinkSection />

      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-sm font-semibold text-slate-800">Catégories d'achats</h2>
          <button className="btn-secondary" onClick={() => setShowNewForm((v) => !v)}>
            {showNewForm ? 'Fermer' : '+ Nouvelle catégorie'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Adaptez la liste des familles d'achats à votre domaine d'activité. Une catégorie déjà utilisée par des
          articles, fournisseurs, besoins de section ou contrats-cadres ne peut pas être supprimée (intégrité des données).
        </p>

        {showNewForm && (
          <NouvelleCategorieForm
            onCancel={() => setShowNewForm(false)}
            onCreated={() => { setShowNewForm(false); setRefreshKey((k) => k + 1); }}
          />
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-th">Nom</th>
                <th className="table-th">Description</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td className="table-td text-slate-400" colSpan={3}>Chargement…</td></tr>}
              {!loading && categories.map((c) => (
                <CategorieRow key={c.id} categorie={c} onChanged={() => setRefreshKey((k) => k + 1)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ArticlesSection categories={categories} />
    </div>
  );
}
