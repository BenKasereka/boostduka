'use strict';
// =====================================================================
// BoostDuka — Generateur de dataset fictif (cas d'etude VISIBA Logistics Group)
// Etape 1 : peuple provinces / sections / categories / articles /
//           fournisseurs / devis / contrats_cadres / commandes
// Sortie  : ./data/*.json + ./data/*.csv + ./data/seed.sql
// Usage   : node scripts/generate-dataset.cjs  (ou: npm run generate:dataset)
// =====================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  PROVINCES,
  SECTIONS,
  VILLES_PAR_PROVINCE,
  PRENOMS,
  NOMS,
  ENTREPRISE_PREFIXES,
  ENTREPRISE_SUFFIXES,
  CONDITIONS_PAIEMENT,
  CATEGORIES,
} = require('./lib/pools.cjs');

// ---------------------------------------------------------------------
// PRNG deterministe (mulberry32) : meme seed => meme dataset a chaque run
// ---------------------------------------------------------------------
const SEED = 20260830;

// Taux de reference utilise pour generer des montants CDF realistes
// (doit rester coherent avec src/lib/currency.js cote frontend).
const CDF_PER_USD = 2800;
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const randFloat = (min, max, decimals = 2) => {
  const v = rand() * (max - min) + min;
  return Number(v.toFixed(decimals));
};
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const pickMany = (arr, n) => {
  const pool = [...arr];
  const out = [];
  n = Math.min(n, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = randInt(0, pool.length - 1);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
};
const chance = (p) => rand() < p;
const uuid = () => crypto.randomUUID();

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function fmt(date) {
  return date.toISOString().slice(0, 10);
}

// Fenetre temporelle : 12 mois glissants se terminant "aujourd'hui" (fictif, fige pour reproductibilite)
const TODAY = new Date('2026-08-30');
const WINDOW_START = addDays(TODAY, -365);

// ---------------------------------------------------------------------
// 1) provinces
// ---------------------------------------------------------------------
const provinces = PROVINCES.map((nom, i) => ({ id: i + 1, nom_province: nom }));
const provinceIdByNom = Object.fromEntries(provinces.map((p) => [p.nom_province, p.id]));

// ---------------------------------------------------------------------
// 2) sections (6 bases)
// ---------------------------------------------------------------------
const sections = SECTIONS.map((s) => ({
  id: uuid(),
  nom_base: s.nom_base,
  province_id: provinceIdByNom[s.province],
  province_nom: s.province,
  nom_responsable: `${pick(PRENOMS)} ${pick(NOMS)}`,
  email_responsable: null, // rempli plus bas
  telephone_responsable: `+243${randInt(80, 99)}${randInt(1000000, 9999999)}`,
  date_ouverture_base: fmt(addDays(WINDOW_START, -randInt(200, 1500))),
}));
sections.forEach((s) => {
  const slug = s.nom_responsable.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, '.');
  s.email_responsable = `${slug}@visiba-logistics.org`;
});

// ---------------------------------------------------------------------
// 3) categories_articles (15)
// ---------------------------------------------------------------------
const categories = CATEGORIES.map((c, i) => ({ id: i + 1, nom_categorie: c.nom }));
const categorieIdByNom = Object.fromEntries(categories.map((c) => [c.nom_categorie, c.id]));

// ---------------------------------------------------------------------
// 4) articles (10-20 par categorie -> catalogue complet)
// ---------------------------------------------------------------------
let articleAutoId = 1;
const articles = [];
CATEGORIES.forEach((c) => {
  const categorie_id = categorieIdByNom[c.nom];
  c.articles.forEach(([nom_article, unite_mesure, description_specification]) => {
    articles.push({ id: articleAutoId++, categorie_id, nom_article, unite_mesure, description_specification: description_specification || null });
  });
});
const articlesByCategorie = {};
articles.forEach((a) => {
  (articlesByCategorie[a.categorie_id] ||= []).push(a);
});

// ---------------------------------------------------------------------
// 5) section_besoins (chaque section: 5-8 categories recurrentes)
// ---------------------------------------------------------------------
const section_besoins = [];
sections.forEach((s) => {
  const nbCategories = randInt(5, 8);
  const cats = pickMany(categories, nbCategories);
  cats.forEach((c) => {
    section_besoins.push({
      section_id: s.id,
      categorie_id: c.id,
      priorite: randInt(1, 3),
    });
  });
});

// ---------------------------------------------------------------------
// 6) fournisseurs (120)
// ---------------------------------------------------------------------
const NB_FOURNISSEURS = 120;
const fournisseurs = [];
const usedNames = new Set();

function genNomEntreprise() {
  let nom;
  let tries = 0;
  do {
    nom = `${pick(ENTREPRISE_PREFIXES)} ${pick(ENTREPRISE_SUFFIXES)}`;
    tries++;
  } while (usedNames.has(nom) && tries < 50);
  usedNames.add(nom);
  return nom;
}

for (let i = 0; i < NB_FOURNISSEURS; i++) {
  const province = pick(PROVINCES);
  const ville = pick(VILLES_PAR_PROVINCE[province]);
  const profil_prix = pick(['economique', 'economique', 'standard', 'standard', 'standard', 'premium']);

  // Score de fiabilite correle au profil (mais avec bruit) : premium plus fiable en moyenne
  let baseScore;
  if (profil_prix === 'premium') baseScore = randFloat(75, 98);
  else if (profil_prix === 'standard') baseScore = randFloat(55, 88);
  else baseScore = randFloat(30, 75);

  const statut = chance(0.06) ? 'suspendu' : chance(0.03) ? 'blackliste' : 'actif';
  const nbCategoriesCouvertes = randInt(1, 4);
  const categoriesCouvertes = pickMany(categories, nbCategoriesCouvertes);

  const nom = genNomEntreprise();
  const slug = nom.toLowerCase().replace(/[^a-z0-9]+/g, '');

  const f = {
    id: uuid(),
    nom,
    province_id: provinceIdByNom[province],
    province_nom: province,
    ville,
    conditions_paiement: pick(CONDITIONS_PAIEMENT),
    statut,
    score_fiabilite: Math.round(baseScore * 100) / 100,
    date_dernier_evaluation: fmt(addDays(TODAY, -randInt(5, 300))),
    profil_prix,
    email_contact: `contact@${slug}.cd`,
    telephone_contact: `+243${randInt(80, 99)}${randInt(1000000, 9999999)}`,
    date_enregistrement: fmt(addDays(WINDOW_START, -randInt(30, 2000))),
    _categories: categoriesCouvertes.map((c) => c.id), // usage interne generation
  };
  fournisseurs.push(f);
}

const fournisseur_categories = [];
fournisseurs.forEach((f) => {
  f._categories.forEach((catId) => {
    fournisseur_categories.push({ fournisseur_id: f.id, categorie_id: catId });
  });
});

// Index fournisseurs actifs par categorie (pour generer devis/commandes coherents)
const fournisseursParCategorie = {};
fournisseurs.forEach((f) => {
  if (f.statut !== 'actif') return;
  f._categories.forEach((catId) => {
    (fournisseursParCategorie[catId] ||= []).push(f);
  });
});

// ---------------------------------------------------------------------
// Moteur de prix : prix de base par article (pseudo-realiste, USD) +
// multiplicateur selon profil fournisseur + bruit
// ---------------------------------------------------------------------
const PRIX_BASE_PAR_CATEGORIE = {
  'Medical / PharMed': [2, 60],
  'WASH (Eau-Hygiene-Assainissement)': [1, 150],
  'NFI (Biens non-alimentaires)': [3, 90],
  'Carburant / Energie': [1, 400],
  'Pieces detachees vehicules': [8, 350],
  'IT / Telecommunications': [15, 900],
  'Materiaux de construction': [2, 60],
  'Groupes electrogenes': [50, 4500],
  'Alimentaire / Nutrition': [10, 65],
  'EPI (Equipement protection individuelle)': [2, 45],
  'Mobilier / Bureau': [3, 220],
  'Transport / Freight': [20, 1200],
  'Textile / Uniformes': [4, 60],
  'Outillage / Equipement technique': [10, 600],
  "Produits d'hygiene / Nettoyage": [1, 40],
  'Fourniture de Bureau': [1, 60],
  "Service d'Impression et Visibilite": [2, 250],
  'Materiels Electronique et Electrique': [3, 200],
};

function prixBaseArticle(article) {
  const catNom = categories.find((c) => c.id === article.categorie_id).nom_categorie;
  const [min, max] = PRIX_BASE_PAR_CATEGORIE[catNom] || [5, 100];
  // prix "de marche" stable par article via hash simple du nom (reproductible)
  let h = 0;
  for (const ch of article.nom_article) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const frac = (h % 1000) / 1000;
  return min + frac * (max - min);
}

function multiplicateurProfil(profil) {
  if (profil === 'economique') return randFloat(0.75, 0.95, 3);
  if (profil === 'premium') return randFloat(1.15, 1.5, 3);
  return randFloat(0.92, 1.15, 3);
}

function delaiLivraisonProfil(profil) {
  if (profil === 'economique') return randInt(1, 7);      // rapide, mais moins fiable
  if (profil === 'premium') return randInt(10, 30);        // qualite haute, delai long
  return randInt(4, 15);
}

// ---------------------------------------------------------------------
// 7) devis (plusieurs fournisseurs par article, plusieurs dates)
// ---------------------------------------------------------------------
const devis = [];
articles.forEach((article) => {
  const candidats = fournisseursParCategorie[article.categorie_id] || [];
  if (candidats.length === 0) return;
  const nbDevis = Math.min(candidats.length, randInt(2, 6));
  const fournisseursChoisis = pickMany(candidats, nbDevis);
  const prixMarche = prixBaseArticle(article);

  fournisseursChoisis.forEach((f) => {
    // 1 a 2 rounds de devis dans le temps pour permettre l'historique de prix
    const nbRounds = chance(0.35) ? 2 : 1;
    for (let r = 0; r < nbRounds; r++) {
      const dateSoumission = addDays(WINDOW_START, randInt(0, 365));
      const prixUnitaireUsd = Math.max(0.1, prixMarche * multiplicateurProfil(f.profil_prix) * randFloat(0.95, 1.05, 3));
      const devise = chance(0.85) ? 'USD' : 'CDF';
      const prixUnitaire = devise === 'CDF'
        ? Math.round(prixUnitaireUsd * CDF_PER_USD)
        : Math.round(prixUnitaireUsd * 100) / 100;
      // Transport inclus : plus frequent chez les fournisseurs premium (prix
      // tout compris) que chez les economiques (prix nu, transport a part).
      const probaTransportInclus = f.profil_prix === 'premium' ? 0.75 : f.profil_prix === 'standard' ? 0.45 : 0.2;

      devis.push({
        id: uuid(),
        fournisseur_id: f.id,
        article_id: article.id,
        prix_unitaire: prixUnitaire,
        devise,
        quantite_reference: pick([1, 5, 10, 20, 50, 100]),
        delai_livraison_jours: delaiLivraisonProfil(f.profil_prix),
        transport_inclus: chance(probaTransportInclus),
        // Stock disponible chez le fournisseur au moment du devis (0 = rupture)
        stock_disponible: chance(0.06) ? 0 : pick([5, 10, 20, 50, 100, 200, 500]),
        validite_offre_date: fmt(addDays(dateSoumission, randInt(30, 90))),
        date_soumission: fmt(dateSoumission),
        source_import: 'dataset_fictif',
      });
    }
  });
});

// ---------------------------------------------------------------------
// 8) contrats_cadres (fournisseurs fiables, par categorie)
// ---------------------------------------------------------------------
const contrats_cadres = [];
categories.forEach((cat) => {
  const candidats = (fournisseursParCategorie[cat.id] || []).filter((f) => f.score_fiabilite >= 60);
  if (candidats.length === 0) return;
  const nb = Math.min(candidats.length, randInt(1, 3));
  const choisis = pickMany(candidats, nb);
  choisis.forEach((f) => {
    const debut = addDays(WINDOW_START, -randInt(0, 200));
    const dureeMois = pick([6, 12, 12, 24]);
    const fin = addDays(debut, dureeMois * 30);
    contrats_cadres.push({
      id: uuid(),
      fournisseur_id: f.id,
      categorie_id: cat.id,
      date_debut: fmt(debut),
      date_fin: fmt(fin),
      conditions: f.conditions_paiement,
      statut: fin < TODAY ? 'expire' : chance(0.05) ? 'en_negociation' : 'actif',
      taux_utilisation_pct: randFloat(10, 95, 1),
    });
  });
});

// ---------------------------------------------------------------------
// 9) commandes (historique 12 mois glissants, cycle PR -> PO -> Livraison)
// ---------------------------------------------------------------------
const commandes = [];
sections.forEach((section) => {
  const besoins = section_besoins.filter((b) => b.section_id === section.id);
  // volume mensuel de commandes proportionnel au nombre de besoins de la section
  for (let mois = 0; mois < 12; mois++) {
    const moisDebut = addDays(WINDOW_START, mois * 30);
    besoins.forEach((besoin) => {
      const nbCommandesMois = besoin.priorite === 1 ? randInt(2, 5) : besoin.priorite === 2 ? randInt(1, 3) : randInt(0, 2);
      for (let k = 0; k < nbCommandesMois; k++) {
        const articlesDispo = articlesByCategorie[besoin.categorie_id] || [];
        if (articlesDispo.length === 0) continue;
        const article = pick(articlesDispo);
        const candidats = fournisseursParCategorie[besoin.categorie_id] || [];
        if (candidats.length === 0) continue;
        const fournisseur = pick(candidats);

        const datePR = addDays(moisDebut, randInt(0, 29));
        const delaiPO = randInt(1, 10);
        const datePO = addDays(datePR, delaiPO);
        const delaiLivraisonPrevu = delaiLivraisonProfil(fournisseur.profil_prix);
        const dateLivraisonPrevue = addDays(datePO, delaiLivraisonPrevu);

        // certaines commandes recentes n'ont pas encore ete livrees
        const enCoursNonLivree = dateLivraisonPrevue > TODAY;
        let statut, dateLivraisonReelle, ecartJours;

        if (enCoursNonLivree) {
          statut = 'en_cours';
          dateLivraisonReelle = null;
          ecartJours = null;
        } else if (chance(0.04)) {
          statut = 'annulee';
          dateLivraisonReelle = null;
          ecartJours = null;
        } else {
          // fournisseurs peu fiables -> plus de retard et plus variable
          const fiabilite = fournisseur.score_fiabilite;
          const facteurRetard = fiabilite >= 80 ? 0.12 : fiabilite >= 60 ? 0.3 : 0.55;
          let retard = 0;
          if (chance(facteurRetard)) {
            retard = randInt(1, fiabilite >= 60 ? 10 : 25);
          } else if (chance(0.15)) {
            retard = -randInt(1, 3); // livraison en avance
          }
          dateLivraisonReelle = addDays(dateLivraisonPrevue, retard);
          ecartJours = retard;
          statut = retard > 0 ? 'livree_en_retard' : 'livree_a_temps';
        }

        const prixMarche = prixBaseArticle(article);
        const prixUnitaire = Math.round(prixMarche * multiplicateurProfil(fournisseur.profil_prix) * randFloat(0.95, 1.05, 3) * 100) / 100;

        commandes.push({
          id: uuid(),
          section_id: section.id,
          fournisseur_id: fournisseur.id,
          article_id: article.id,
          quantite: pick([1, 2, 5, 10, 20, 50, 100]),
          prix_unitaire: prixUnitaire,
          devise: 'USD',
          date_pr: fmt(datePR),
          date_po: fmt(datePO),
          date_livraison_prevue: fmt(dateLivraisonPrevue),
          date_livraison_reelle: dateLivraisonReelle ? fmt(dateLivraisonReelle) : null,
          statut,
          ecart_jours: ecartJours,
        });
      }
    });
  }
});

// ---------------------------------------------------------------------
// Nettoyage des champs internes avant export
// ---------------------------------------------------------------------
const fournisseursOut = fournisseurs.map(({ _categories, ...rest }) => rest);

// =====================================================================
// EXPORT : JSON + CSV + seed.sql
// =====================================================================
const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DATA_DIR = path.join(__dirname, '..', 'public', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });

const tables = {
  provinces,
  sections: sections.map(({ province_nom, ...rest }) => rest),
  categories_articles: categories,
  articles,
  section_besoins,
  fournisseurs: fournisseursOut,
  fournisseur_categories,
  devis,
  contrats_cadres,
  commandes,
};

function toCsv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  rows.forEach((r) => lines.push(headers.map((h) => escape(r[h])).join(',')));
  return lines.join('\n');
}

function sqlLiteral(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

let seedSql = '-- Auto-genere par scripts/generate-dataset.cjs — ne pas editer a la main\n\n';

for (const [name, rows] of Object.entries(tables)) {
  const json = JSON.stringify(rows, null, 2);
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), json);
  fs.writeFileSync(path.join(DATA_DIR, `${name}.csv`), toCsv(rows));
  // Copie servie statiquement par le frontend (mode sans Supabase configure)
  fs.writeFileSync(path.join(PUBLIC_DATA_DIR, `${name}.json`), json);

  if (rows.length > 0) {
    const cols = Object.keys(rows[0]);
    seedSql += `-- ${name} (${rows.length} lignes)\n`;
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const values = chunk.map((r) => `  (${cols.map((c) => sqlLiteral(r[c])).join(', ')})`).join(',\n');
      seedSql += `insert into ${name} (${cols.join(', ')}) values\n${values};\n`;
    }
    seedSql += '\n';
  }
}
fs.writeFileSync(path.join(DATA_DIR, 'seed.sql'), seedSql);

// ---------------------------------------------------------------------
// Resume console
// ---------------------------------------------------------------------
console.log('=== Dataset genere avec succes (seed=%d) ===', SEED);
for (const [name, rows] of Object.entries(tables)) {
  console.log(`  ${name.padEnd(24)} : ${rows.length} lignes`);
}
console.log(`\nFichiers ecrits dans : ${DATA_DIR}`);
