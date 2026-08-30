# Modèle de données Power BI — VISIBA Procurement Intelligence Hub

Ce document décrit comment connecter les tables exportées (module *Export Power BI*
de l'application, ou directement `data/*.csv` / `data/seed.sql`) dans Power BI
Desktop, et propose les mesures DAX correspondant aux KPIs du dashboard.

## 1. Schéma en étoile suggéré

```
                        ┌───────────────┐
                        │   provinces   │  (dimension)
                        └───────┬───────┘
                                │ 1
                    ┌───────────┴───────────┐
                    │ N                     │ N
            ┌───────▼───────┐       ┌───────▼───────┐
            │  fournisseurs  │       │    sections    │  (dimensions)
            └───────┬────────┘       └───────┬────────┘
                     │ 1                      │ 1
        ┌────────────┼────────────┐           │ N
        │ N                       │ N   ┌─────▼──────────────┐
┌───────▼────────┐       ┌────────▼───┐ │ section_besoins    │ (pont N-N)
│     devis       │       │ contrats_  │ └─────┬──────────────┘
│  (fait: sourcing)│      │  cadres    │       │ N
└───────┬─────────┘       │ (fait)     │       │
        │ N                └─────┬──────┘       │
        │                        │ N            │
        │              ┌─────────▼──────────────▼─┐
        │              │     categories_articles    │ (dimension)
        │              └─────────────┬──────────────┘
        │ N                          │ 1
┌───────▼─────────┐                  │ N
│    articles      │◄─────────────────┘
│   (dimension)     │
└───────┬───────────┘
        │ 1
        │ N
┌───────▼──────────┐        ┌────────────────────────┐
│    commandes      │        │ fournisseur_categories │ (pont N-N,
│ (fait: cycle achat)│        │ fournisseurs × catégories) │
└────────────────────┘        └────────────────────────┘
```

**Dimensions** : `provinces`, `sections`, `categories_articles`, `articles`, `fournisseurs`
**Tables de pont (N-N)** : `fournisseur_categories`, `section_besoins`
**Faits** : `devis` (sourcing), `contrats_cadres` (contrats), `commandes` (cycle PR→PO→Livraison)

## 2. Relations à créer dans Power BI (Modèle > Gérer les relations)

| De (plusieurs) | Vers (un) | Clé | Cardinalité |
|---|---|---|---|
| fournisseurs | provinces | province_id → id | N:1 |
| sections | provinces | province_id → id | N:1 |
| fournisseur_categories | fournisseurs | fournisseur_id → id | N:1 |
| fournisseur_categories | categories_articles | categorie_id → id | N:1 |
| section_besoins | sections | section_id → id | N:1 |
| section_besoins | categories_articles | categorie_id → id | N:1 |
| articles | categories_articles | categorie_id → id | N:1 |
| devis | fournisseurs | fournisseur_id → id | N:1 |
| devis | articles | article_id → id | N:1 |
| contrats_cadres | fournisseurs | fournisseur_id → id | N:1 |
| contrats_cadres | categories_articles | categorie_id → id | N:1 |
| commandes | sections | section_id → id | N:1 |
| commandes | fournisseurs | fournisseur_id → id | N:1 |
| commandes | articles | article_id → id | N:1 |

Toutes les relations sont **à sens unique** (filtre simple), ce qui suffit pour
tous les KPIs du dashboard. `fournisseur_categories` et `section_besoins` sont
des tables de pont : ne pas créer de relation directe fournisseurs↔sections.

## 3. Dimension Date (recommandé pour le time intelligence)

Le modèle contient plusieurs colonnes de date sur des tables différentes
(`devis[date_soumission]`, `commandes[date_pr/date_po/date_livraison_prevue/
date_livraison_reelle]`, `contrats_cadres[date_debut/date_fin]`). Power BI ne
gère qu'une relation *active* par paire de tables : créez une table `dim_date`
calculée (Power Query > Nouvelle source > Plage de dates, ou `CALENDAR()` en
DAX) couvrant la fenêtre complète du dataset, reliez-la à `commandes[date_pr]`
en relation active, et aux autres colonnes de date en relation **inactive**
(à activer ponctuellement avec `USERELATIONSHIP()` dans les mesures qui en ont besoin).

```dax
Dim Date = CALENDAR(DATE(2025,1,1), DATE(2026,12,31))
```

## 4. Colonnes calculées prérequises

Plusieurs mesures financières comparent un prix réel au prix moyen du marché.
Ajoutez cette colonne calculée sur `articles` avant d'écrire les mesures qui
en dépendent :

```dax
articles[prix_moyen_marche] =
AVERAGEX(
    RELATEDTABLE(devis),
    devis[prix_unitaire]
)
```

## 5. Mesures DAX suggérées (par phase du cycle procurement)

### Needs Assessment
```dax
PR Traités = COUNTROWS(commandes)

Taux Annulation Post-PR =
DIVIDE(
    CALCULATE(COUNTROWS(commandes), commandes[statut] = "annulee"),
    [PR Traités]
)
```

### Sourcing / RFQ
```dax
Fournisseurs Consultés (Devis) = DISTINCTCOUNT(devis[fournisseur_id])

Fournisseurs Consultés / Catégorie =
AVERAGEX(
    VALUES(categories_articles[id]),
    CALCULATE(DISTINCTCOUNT(devis[fournisseur_id]))
)

Taux Mise en Concurrence (≥3 devis) =
VAR ArticlesTotal = CALCULATE(DISTINCTCOUNT(devis[article_id]))
VAR ArticlesConcurrences =
    CALCULATE(
        DISTINCTCOUNT(devis[article_id]),
        FILTER(
            VALUES(devis[article_id]),
            CALCULATE(DISTINCTCOUNT(devis[fournisseur_id])) >= 3
        )
    )
RETURN DIVIDE(ArticlesConcurrences, ArticlesTotal)
```

### Award / CBA
```dax
Prix Moyen Payé = AVERAGE(commandes[prix_unitaire])

Écart Prix vs Marché % =
AVERAGEX(
    commandes,
    DIVIDE(
        RELATED(articles[prix_moyen_marche]) - commandes[prix_unitaire],
        RELATED(articles[prix_moyen_marche])
    )
)
```

### Contrats-cadres
```dax
Taux Utilisation Moyen = AVERAGE(contrats_cadres[taux_utilisation_pct])

Contrats Actifs = CALCULATE(COUNTROWS(contrats_cadres), contrats_cadres[statut] = "actif")

Couverture Catégorielle % =
DIVIDE(
    CALCULATE(DISTINCTCOUNT(contrats_cadres[categorie_id]), contrats_cadres[statut] = "actif"),
    DISTINCTCOUNT(categories_articles[id])
)

Échéances < 90 jours =
CALCULATE(
    COUNTROWS(contrats_cadres),
    contrats_cadres[statut] = "actif",
    contrats_cadres[date_fin] <= TODAY() + 90,
    contrats_cadres[date_fin] >= TODAY()
)
```

### Commande → Livraison
```dax
Lead Time Moyen (jours) =
AVERAGEX(
    FILTER(commandes, NOT ISBLANK(commandes[date_livraison_reelle])),
    DATEDIFF(commandes[date_pr], commandes[date_livraison_reelle], DAY)
)

Taux Livraison à Temps =
DIVIDE(
    CALCULATE(COUNTROWS(commandes), commandes[statut] = "livree_a_temps"),
    CALCULATE(COUNTROWS(commandes), commandes[statut] IN {"livree_a_temps", "livree_en_retard"})
)

Taux Rupture (Annulation) =
DIVIDE(
    CALCULATE(COUNTROWS(commandes), commandes[statut] = "annulee"),
    COUNTROWS(commandes)
)
```

### Performance fournisseur
```dax
Score Fiabilité Moyen = AVERAGE(fournisseurs[score_fiabilite])

Nb Commandes Fournisseur = COUNTROWS(commandes)

Taux Livraison à Temps (par fournisseur) = [Taux Livraison à Temps]
-- Se décline automatiquement par fournisseur si la mesure est placée
-- dans une visualisation groupée par fournisseurs[nom].
```

### Financier
```dax
Exposition Budgétaire = SUMX(commandes, commandes[prix_unitaire] * commandes[quantite])

Coût Évité Cumulé =
SUMX(
    commandes,
    MAX(0, RELATED(articles[prix_moyen_marche]) - commandes[prix_unitaire]) * commandes[quantite]
)
```

## 6. Notes de portabilité

- Les colonnes de type texte enum (`statut`, `devise`, `profil_prix`…) sont
  exportées telles quelles (valeurs Postgres) — créez des tables de traduction
  Power Query si vous voulez des libellés différents à l'affichage.
- `evaluations_comparatives` / `evaluation_articles` / `evaluation_lignes`
  (feuilles de synthèse comparative, module CBA) ne sont **pas** incluses
  dans cet export : elles vivent en `localStorage` côté navigateur tant que
  Supabase n'est pas branché en écriture (voir `.env.example`). Une fois
  Supabase actif, elles deviennent exportables de la même façon que les
  autres tables.

## 7. Publier sur Power BI Service

Cette étape se fait entièrement dans Power BI Desktop, avec votre propre
compte Microsoft/Power BI — c'est une action manuelle qui vous revient
(ni un outil en ligne de commande, ni un identifiant que je dois manipuler).

1. **Installer Power BI Desktop** (gratuit) depuis [powerbi.microsoft.com/desktop](https://www.microsoft.com/fr-fr/power-platform/products/power-bi/desktop) si ce n'est pas déjà fait.

2. **Récupérer les données** — deux options :
   - *Dataset fictif / démo* : ouvrez le module **Export Power BI** de l'application, cliquez « Télécharger toutes les tables », puis dans Power BI Desktop : `Accueil > Obtenir les données > Classeur Excel` et sélectionnez le fichier téléchargé (un onglet = une table).
   - *Données réelles (Supabase branché)* : `Accueil > Obtenir les données > Base de données > PostgreSQL`, puis renseignez l'hôte/port/base de votre projet Supabase (Project Settings → Database, dans le tableau de bord Supabase). Cela permet une actualisation automatique plus tard.

3. **Construire le modèle** — dans l'onglet *Modèle* de Power BI Desktop, recréez les relations listées en section 2 de ce document (glisser-déposer entre les colonnes clé/étrangère). Ajoutez la dimension Date (section 3) et la colonne calculée `prix_moyen_marche` (section 4).

4. **Ajouter les mesures DAX** — `Modélisation > Nouvelle mesure`, puis copiez-collez chaque formule de la section 5 de ce document.

5. **Construire les pages du rapport** — un découpage possible, calqué sur le Dashboard KPI de l'application :
   - Page 1 — Vue d'ensemble (cartes KPI + tendance lead time)
   - Page 2 — Sourcing & Award (fournisseurs consultés par catégorie, écart prix)
   - Page 3 — Contrats-cadres & Livraison (jauge utilisation, échéances, taux à temps)
   - Page 4 — Performance fournisseur & Financier (classement, exposition budgétaire)

6. **Publier** — bouton `Accueil > Publier` (en haut à droite). Power BI Desktop vous demande de vous connecter à votre compte Microsoft/Power BI si ce n'est pas déjà fait, puis de choisir un **espace de travail** (workspace) de destination. Une fois publié, le rapport est disponible sur [app.powerbi.com](https://app.powerbi.com) sous votre compte.

7. **Après publication** (dans Power BI Service, app.powerbi.com) :
   - Si connecté à Supabase : configurez l'**actualisation planifiée** des données (`Paramètres du dataset > Actualisation planifiée`) — nécessite la passerelle de données locale si Supabase n'est pas dans la liste des connecteurs cloud natifs, ou un simple identifiant/mot de passe PostgreSQL si le connecteur cloud suffit.
   - **Partager** le rapport via `Partager` (lien direct) ou l'intégrer à un espace de travail d'équipe.

Cette dernière étape (installation, connexion, clic sur Publier) ne peut pas être automatisée depuis cet outil : Power BI Desktop est une application de bureau Windows, et la publication authentifie votre propre compte Microsoft — deux choses hors de portée d'un agent en ligne de commande, par conception.
