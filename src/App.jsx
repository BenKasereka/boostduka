import { lazy, Suspense, useState } from 'react';
import AppShell from './components/AppShell';
import { DevisePreferenceProvider } from './lib/DevisePreferenceContext';

const ListePrix = lazy(() => import('./pages/ListePrix'));
const BaseFournisseurs = lazy(() => import('./pages/BaseFournisseurs'));
const ImportDevis = lazy(() => import('./pages/ImportDevis'));
const SyntheseComparative = lazy(() => import('./pages/SyntheseComparative'));
const CBA = lazy(() => import('./pages/CBA'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ExportPowerBI = lazy(() => import('./pages/ExportPowerBI'));
const Configuration = lazy(() => import('./pages/Configuration'));

export default function App() {
  const [activePage, setActivePage] = useState('liste-prix');

  return (
    <DevisePreferenceProvider>
      <AppShell activePage={activePage} onNavigate={setActivePage}>
        <Suspense fallback={<div className="text-sm text-slate-400 py-10 text-center">Chargement…</div>}>
          {activePage === 'liste-prix' && <ListePrix />}
          {activePage === 'fournisseurs' && <BaseFournisseurs />}
          {activePage === 'import' && <ImportDevis />}
          {activePage === 'synthese' && <SyntheseComparative />}
          {activePage === 'cba' && <CBA />}
          {activePage === 'dashboard' && <Dashboard />}
          {activePage === 'export-pbi' && <ExportPowerBI />}
          {activePage === 'configuration' && <Configuration />}
        </Suspense>
      </AppShell>
    </DevisePreferenceProvider>
  );
}
