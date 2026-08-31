# BoostDuka

**Outil de Business Intelligence pour la gestion procurement multi-sites en contexte humanitaire.**
Étude de cas : intersection procurement de VISIBA Logistics Group, 6 bases opérationnelles en République Démocratique du Congo.

Projet portfolio réalisé par [Ben Kasereka](https://benkasereka.github.io) dans le cadre d'une candidature au poste de **Procurement Manager — Intersection** chez MSF Niger.

**Démo en ligne : [visiba-procurement-hub.vercel.app](https://visiba-procurement-hub.vercel.app/)**

---

## Contexte

VISIBA Logistics Group opère 6 bases en RDC (Kinshasa, Nord-Kivu, Sud-Kivu, Haut-Katanga,
Ituri, Kasaï-Central). Chaque section achète localement, mais aucune vue consolidée
n'existe pour comparer les prix pratiqués d'une province à l'autre, évaluer la fiabilité
réelle des fournisseurs, ou justifier une attribution de marché de façon traçable.

Le rôle d'un **Procurement Analyst / Manager Intersection** est précisément de combler
ce vide : centraliser les données fournisseurs, conseiller chaque section sur ses achats,
et faire remonter une vision agrégée du cycle procurement — du *Needs Assessment* jusqu'à
l'exécution des contrats-cadres.

## Problème résolu

Sans outil transversal, une organisation multi-sites répète les mêmes travers :

- **Prix non comparables** entre sections faute de base de prix partagée
- **Sélection de fournisseurs non tracée** — pas de preuve d'audit sur *pourquoi* tel
  fournisseur a été retenu plutôt qu'un autre
- **Contrats-cadres sous-exploités** faute de visibilité sur leur taux d'utilisation
  et leurs échéances
- **KPIs procurement dispersés** (délais, taux de livraison à temps, exposition
  budgétaire) sans dashboard consolidé

Cet outil répond aux quatre à la fois, à partir d'un unique dataset de devis fournisseurs.

## Ce que fait l'outil

| Module | Fonction |
|---|---|
| **Liste de Prix** | Comparateur Fournisseur × Catégorie × Article × Prix, filtrable par province/catégorie, export Excel |
| **Base Fournisseurs** | Fiche complète par fournisseur (score de fiabilité, catégories couvertes, conditions de paiement, contrats-cadres), export Excel |
| **Demande de devis (RFQ)** | Sélection d'articles + fournisseurs à consulter, génération d'un modèle Excel et d'un document imprimable adressé à chaque fournisseur |
| **Import de devis** | Import Excel/CSV d'une quotation fournisseur, avec validation ligne par ligne et matching au catalogue d'articles |
| **Synthèse comparative** | Scoring pondéré multicritères (Prix / Qualité / Délai / Disponibilité / Conditions de paiement) pour sélectionner un fournisseur, avec justification en texte libre |
| **CBA (Comparative Bid Analysis)** | Document d'audit imprimable généré à partir d'une synthèse validée — prêt à signer et archiver |
| **Bon de Commande (PO)** | Généré depuis un CBA validé (un PO par fournisseur retenu), écrit dans l'historique des commandes |
| **Dashboard KPI** | 7 phases du cycle procurement (Needs Assessment → Sourcing → Award/CBA → Contrats-cadres → Livraison → Performance fournisseur → Financier), filtrable par section/province/catégorie/période |
| **Export Power BI** | Tables nettoyées (CSV/Excel), modèle relationnel documenté (schéma en étoile) et mesures DAX suggérées |

## Compétences démontrées

- **Analyse procurement** : construction d'une méthodologie de scoring pondéré
  multicritères transparente et documentée, plutôt que d'un jugement arbitraire
- **Modélisation de données** : schéma relationnel normalisé (Postgres/Supabase),
  pensé dès le départ pour un usage BI en aval (schéma en étoile, tables de pont N-N)
- **Conseil multi-sites** : dashboard structuré autour des vrais points de décision
  d'un analyste intersection (comparaison inter-provinces, couverture contractuelle,
  performance fournisseur)
- **Rigueur méthodologique** : deux KPIs du brief initial (Needs Assessment,
  taux de réponse RFQ) n'avaient pas de source de données dédiée dans ce dataset —
  plutôt que de les fabriquer, ils sont remplacés par un proxy calculable et
  explicitement étiqueté comme tel dans l'interface
- **BI / reporting** : préparation d'un export Power BI complet (modèle + mesures DAX),
  dashboard interactif (Recharts) avec filtres croisés

## Stack technique

- **Frontend** : React 18 + Vite, Tailwind CSS
- **Données** : Supabase (Postgres) si configuré, sinon dataset JSON local généré par script — bascule transparente, aucun changement de code applicatif
- **Import/Export** : SheetJS (xlsx) pour Excel multi-onglets, export CSV natif
- **Visualisation** : Recharts
- **Impression** : CSS natif (`@media print`), export PDF via le navigateur

## Structure du dépôt

```
supabase/
  schema.sql                 Schéma Postgres complet (10 tables + enums + index)
  modele_donnees_PBI.md      Documentation du modèle relationnel + mesures DAX
scripts/
  generate-dataset.cjs       Génère un dataset fictif réaliste (120 fournisseurs, 835+ devis...)
  lib/pools.cjs              Référentiels RDC (provinces, catégories, articles, noms fictifs)
data/                        Dataset généré (CSV + JSON + seed.sql)
public/data/                 Copie servie au frontend en mode démo (sans Supabase)
src/
  lib/                       Couche de données, scoring, import, exports
  pages/                     Les 7 modules de l'application
  components/                AppShell, KpiCard
```

## Lancer le projet en local

```bash
npm install
npm run generate:dataset   # régénère le dataset fictif dans data/ et public/data/
npm run dev                # démarre l'app sur http://localhost:5173
```

Sans configuration Supabase, l'application fonctionne immédiatement en mode démo
sur le dataset fictif (`public/data/*.json`). Pour brancher un vrai projet Supabase,
copier `.env.example` en `.env` et renseigner `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` — le reste de l'application bascule automatiquement,
sans modification de code.

## Notes sur les données

Le dataset (fournisseurs, devis, commandes) est **entièrement fictif** — aucune
marque ou entreprise réelle n'est utilisée — mais généré avec une variabilité
réaliste (profils fournisseurs économique/standard/premium, taux de retard
plausibles, historique de commandes sur 12 mois glissants) pour permettre des
KPIs et des comparaisons crédibles.

## Limites connues / pistes V2

- Import PDF de devis (V1 : Excel/CSV uniquement)
- Écriture temps réel dans Supabase pour les feuilles de synthèse comparative et
  les dossiers CBA (V1 : persistées en `localStorage` tant que Supabase n'est
  pas configuré en écriture)
- Reconnaissance d'un nouvel article hors catalogue à l'import (V1 : les lignes
  référençant un article inconnu sont signalées en erreur plutôt qu'ajoutées
  automatiquement, pour préserver l'intégrité du modèle relationnel)
