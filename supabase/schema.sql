-- =====================================================================
-- VISIBA Procurement Intelligence Hub — Schéma Supabase (Postgres)
-- RDC — 6 sections opérationnelles
-- =====================================================================
-- Notes de conception :
--  - Les listes (categories_couvertes[], besoins_recurrents_categories[])
--    demandées dans le brief sont modélisées en tables de jointure
--    (fournisseur_categories, section_besoins) plutôt qu'en colonnes array,
--    pour un modèle relationnel propre exploitable directement par Power BI
--    (schéma en étoile, relations 1-N / N-N explicites).
--  - Un catalogue "articles" est ajouté (non listé explicitement dans le
--    brief mais implicite : "10 à 20 articles types par catégorie") afin
--    que devis/commandes référencent un article normalisé plutôt qu'un
--    libellé libre — nécessaire pour comparer les prix entre fournisseurs.
--  - gen_random_uuid() nécessite l'extension pgcrypto (activée par défaut
--    sur Supabase).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type statut_fournisseur as enum ('actif', 'suspendu', 'blackliste');
create type devise_type as enum ('USD', 'CDF');
create type statut_contrat as enum ('actif', 'expire', 'en_negociation', 'resilie');
create type statut_commande as enum ('en_cours', 'livree_a_temps', 'livree_en_retard', 'annulee');

-- ---------------------------------------------------------------------
-- TABLE: provinces (référentiel géographique RDC — 6 provinces couvertes)
-- ---------------------------------------------------------------------
create table provinces (
    id              smallserial primary key,
    nom_province    text not null unique
);

comment on table provinces is 'Provinces RDC couvertes par VISIBA (une base/section par province)';

-- ---------------------------------------------------------------------
-- TABLE: sections (les 6 bases opérationnelles VISIBA)
-- ---------------------------------------------------------------------
create table sections (
    id                          uuid primary key default gen_random_uuid(),
    nom_base                    text not null unique,
    province_id                 smallint not null references provinces(id),
    nom_responsable             text not null,
    email_responsable           text,
    telephone_responsable       text,
    date_ouverture_base         date not null,
    created_at                  timestamptz not null default now()
);

comment on table sections is 'Les 6 bases/sections opérationnelles VISIBA en RDC';

-- ---------------------------------------------------------------------
-- TABLE: categories_articles (15+ catégories d''achats)
-- ---------------------------------------------------------------------
create table categories_articles (
    id              smallserial primary key,
    nom_categorie   text not null unique,
    description     text
);

comment on table categories_articles is 'Familles d''achats (Médical, WASH, NFI, Carburant, IT, etc.)';

-- ---------------------------------------------------------------------
-- TABLE: articles (catalogue d''articles par catégorie, 10-20 / catégorie)
-- ---------------------------------------------------------------------
create table articles (
    id              serial primary key,
    categorie_id    smallint not null references categories_articles(id),
    nom_article     text not null,
    unite_mesure    text not null,           -- ex: pièce, carton, litre, kg, unité
    unique (categorie_id, nom_article)
);

comment on table articles is 'Catalogue d''articles types par catégorie';

-- ---------------------------------------------------------------------
-- TABLE: section_besoins (jointure N-N sections <-> catégories récurrentes)
-- ---------------------------------------------------------------------
create table section_besoins (
    section_id      uuid not null references sections(id) on delete cascade,
    categorie_id    smallint not null references categories_articles(id) on delete cascade,
    priorite        smallint not null default 2 check (priorite between 1 and 3), -- 1=critique .. 3=occasionnel
    primary key (section_id, categorie_id)
);

comment on table section_besoins is 'Besoins récurrents par catégorie pour chaque section (remplace besoins_recurrents_categories[])';

-- ---------------------------------------------------------------------
-- TABLE: fournisseurs
-- ---------------------------------------------------------------------
create table fournisseurs (
    id                          uuid primary key default gen_random_uuid(),
    nom                         text not null,
    province_id                 smallint not null references provinces(id),
    ville                       text,
    conditions_paiement         text not null,   -- ex: "Net 30", "50% avance / 50% livraison"
    statut                      statut_fournisseur not null default 'actif',
    score_fiabilite             numeric(5,2) not null check (score_fiabilite between 0 and 100),
    date_dernier_evaluation     date not null,
    profil_prix                 text not null check (profil_prix in ('economique','standard','premium')),
    email_contact               text,
    telephone_contact           text,
    date_enregistrement         date not null,
    created_at                  timestamptz not null default now()
);

comment on table fournisseurs is 'Base fournisseurs centralisée toutes sections confondues';
comment on column fournisseurs.profil_prix is 'Variable cachée pilotant la génération des prix/délais (économique=rapide/moins fiable, premium=cher/fiable)';

-- ---------------------------------------------------------------------
-- TABLE: fournisseur_categories (jointure N-N fournisseurs <-> catégories)
-- ---------------------------------------------------------------------
create table fournisseur_categories (
    fournisseur_id  uuid not null references fournisseurs(id) on delete cascade,
    categorie_id    smallint not null references categories_articles(id) on delete cascade,
    primary key (fournisseur_id, categorie_id)
);

comment on table fournisseur_categories is 'Catégories couvertes par chaque fournisseur (remplace categories_couvertes[])';

-- ---------------------------------------------------------------------
-- TABLE: devis (quotations fournisseurs)
-- ---------------------------------------------------------------------
create table devis (
    id                      uuid primary key default gen_random_uuid(),
    fournisseur_id          uuid not null references fournisseurs(id),
    article_id              integer not null references articles(id),
    prix_unitaire           numeric(12,2) not null check (prix_unitaire > 0),
    devise                  devise_type not null default 'USD',
    delai_livraison_jours   integer not null check (delai_livraison_jours >= 0),
    quantite_min            integer not null default 1 check (quantite_min >= 1),
    validite_offre_date     date not null,
    date_soumission         date not null,
    source_import           text default 'dataset_fictif', -- 'dataset_fictif' | 'import_excel' | 'import_pdf'
    created_at              timestamptz not null default now()
);

create index idx_devis_article on devis(article_id);
create index idx_devis_fournisseur on devis(fournisseur_id);
create index idx_devis_date on devis(date_soumission);

comment on table devis is 'Devis/quotations soumis par les fournisseurs pour un article donné';

-- ---------------------------------------------------------------------
-- TABLE: contrats_cadres
-- ---------------------------------------------------------------------
create table contrats_cadres (
    id                      uuid primary key default gen_random_uuid(),
    fournisseur_id          uuid not null references fournisseurs(id),
    categorie_id            smallint not null references categories_articles(id),
    date_debut              date not null,
    date_fin                date not null check (date_fin > date_debut),
    conditions              text,
    statut                  statut_contrat not null default 'actif',
    taux_utilisation_pct    numeric(5,2) not null default 0 check (taux_utilisation_pct between 0 and 100),
    created_at              timestamptz not null default now()
);

create index idx_cc_fournisseur on contrats_cadres(fournisseur_id);
create index idx_cc_categorie on contrats_cadres(categorie_id);

comment on table contrats_cadres is 'Contrats-cadres (Long Term Agreements) fournisseur x catégorie';

-- ---------------------------------------------------------------------
-- TABLE: commandes (cycle PR -> PO -> Livraison)
-- ---------------------------------------------------------------------
create table commandes (
    id                          uuid primary key default gen_random_uuid(),
    section_id                  uuid not null references sections(id),
    fournisseur_id              uuid not null references fournisseurs(id),
    article_id                  integer not null references articles(id),
    quantite                    integer not null check (quantite > 0),
    prix_unitaire               numeric(12,2) not null,
    devise                      devise_type not null default 'USD',
    date_pr                     date not null,
    date_po                     date,
    date_livraison_prevue       date,
    date_livraison_reelle       date,
    statut                      statut_commande not null default 'en_cours',
    ecart_jours                 integer, -- date_livraison_reelle - date_livraison_prevue (négatif = en avance)
    created_at                  timestamptz not null default now()
);

create index idx_commandes_section on commandes(section_id);
create index idx_commandes_fournisseur on commandes(fournisseur_id);
create index idx_commandes_article on commandes(article_id);
create index idx_commandes_date_pr on commandes(date_pr);

comment on table commandes is 'Historique du cycle PR -> PO -> Livraison, 12 mois glissants';

-- ---------------------------------------------------------------------
-- TABLE: evaluations_comparatives (feuille de synthèse — Module 3)
-- En-tête d'une comparaison multicritères pour un article donné.
-- ---------------------------------------------------------------------
create table evaluations_comparatives (
    id                          uuid primary key default gen_random_uuid(),
    article_id                  integer not null references articles(id),
    categorie_id                smallint not null references categories_articles(id),
    section_id                  uuid references sections(id),           -- section demandeuse (optionnel)
    ponderation_prix            numeric(5,2) not null default 35,
    ponderation_qualite         numeric(5,2) not null default 25,
    ponderation_delai           numeric(5,2) not null default 20,
    ponderation_disponibilite   numeric(5,2) not null default 10,
    ponderation_conditions      numeric(5,2) not null default 10,
    fournisseur_retenu_id       uuid references fournisseurs(id),
    justification               text,
    statut                      text not null default 'brouillon' check (statut in ('brouillon','valide')),
    cree_par                    text,   -- email de l'analyste procurement
    created_at                  timestamptz not null default now(),
    updated_at                  timestamptz not null default now()
);

comment on table evaluations_comparatives is 'Feuille de synthèse comparative multicritères (Prix/Qualité/Délai/Disponibilité/Conditions) pour un article donné';

-- ---------------------------------------------------------------------
-- TABLE: evaluation_lignes (une ligne = un fournisseur candidat evalue)
-- ---------------------------------------------------------------------
create table evaluation_lignes (
    id                              uuid primary key default gen_random_uuid(),
    evaluation_id                   uuid not null references evaluations_comparatives(id) on delete cascade,
    fournisseur_id                  uuid not null references fournisseurs(id),
    devis_id                        uuid references devis(id),
    score_prix                      numeric(5,2),
    score_qualite                   numeric(5,2),
    score_delai                     numeric(5,2),
    score_disponibilite             numeric(5,2),
    score_conditions_paiement       numeric(5,2),
    score_pondere_total             numeric(6,2),
    note_libre                      text
);

create index idx_eval_lignes_evaluation on evaluation_lignes(evaluation_id);

comment on table evaluation_lignes is 'Scores par critère et par fournisseur candidat, pour une evaluation_comparative donnée';

-- =====================================================================
-- Table à venir (Étape 4 — non créée ici, réservée) :
--   - cba_dossiers : dossiers CBA archivés (fournisseur retenu + justification,
--     genere a partir d''une evaluations_comparatives validee)
-- =====================================================================
