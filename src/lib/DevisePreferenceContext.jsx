import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'visiba_devise_preference';

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const DevisePreferenceContext = createContext(null);

// Preference globale d'affichage des montants, choisie par l'utilisateur
// selon le pays/contexte de sa mission :
//  - devisePrincipale : devise dans laquelle tous les montants sont convertis
//    et affiches en premier (par defaut USD)
//  - deviseSecondaire : si renseignee, une seconde conversion est affichee
//    en complement ("mode double affichage") ; null = devise unique
export function DevisePreferenceProvider({ children }) {
  const stored = readStored();
  const [devisePrincipale, setDevisePrincipale] = useState(stored?.devisePrincipale || 'USD');
  const [deviseSecondaire, setDeviseSecondaire] = useState(stored?.deviseSecondaire ?? null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ devisePrincipale, deviseSecondaire }));
  }, [devisePrincipale, deviseSecondaire]);

  return (
    <DevisePreferenceContext.Provider value={{ devisePrincipale, setDevisePrincipale, deviseSecondaire, setDeviseSecondaire }}>
      {children}
    </DevisePreferenceContext.Provider>
  );
}

export function useDevisePreference() {
  const ctx = useContext(DevisePreferenceContext);
  if (!ctx) throw new Error('useDevisePreference doit être utilisé sous DevisePreferenceProvider');
  return ctx;
}
