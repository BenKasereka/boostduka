import { lazy, Suspense, useState } from 'react';
import AppShell from './components/AppShell';
import { DevisePreferenceProvider } from './lib/DevisePreferenceContext';
import { PowerBiLinkProvider } from './lib/PowerBiLinkContext';

const ListePrix = lazy(() => import('./pages/ListePrix'));
const BaseFournisseurs = lazy(() => import('./pages/BaseFournisseurs'));
const DemandeInterne = lazy(() => import('./pages/DemandeInterne'));
const DemandeDevis = lazy(() => import('./pages/DemandeDevis'));
const ImportDevis = lazy(() => import('./pages/ImportDevis'));
const SyntheseComparative = lazy(() => import('./pages/SyntheseComparative'));
const CBA = lazy(() => import('./pages/CBA'));
const BonDeCommande = lazy(() => import('./pages/BonDeCommande'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ExportPowerBI = lazy(() => import('./pages/ExportPowerBI'));
const Configuration = lazy(() => import('./pages/Configuration'));

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');

  return (
    <DevisePreferenceProvider>
      <PowerBiLinkProvider>
        <AppShell activePage={activePage} onNavigate={setActivePage}>
          <Suspense fallback={<div className="text-sm text-slate-400 py-10 text-center">Chargement…</div>}>
            {activePage === 'liste-prix' && <ListePrix />}
            {activePage === 'fournisseurs' && <BaseFournisseurs />}
            {activePage === 'demande-interne' && <DemandeInterne onNavigate={setActivePage} />}
            {activePage === 'demande-devis' && <DemandeDevis />}
            {activePage === 'import' && <ImportDevis />}
            {activePage === 'synthese' && <SyntheseComparative />}
            {activePage === 'cba' && <CBA />}
            {activePage === 'po' && <BonDeCommande />}
            {activePage === 'dashboard' && <Dashboard />}
            {activePage === 'export-pbi' && <ExportPowerBI />}
            {activePage === 'configuration' && <Configuration />}
          </Suspense>
        </AppShell>
      </PowerBiLinkProvider>
    </DevisePreferenceProvider>
  );
}
