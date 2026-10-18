import type { Editor } from '@nd/pb-types';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePb } from './lib/pb';
import { Link, navigate } from './lib/router';

const NAV = [
  ['billets', 'Billets'],
  ['categories', 'Catégories'],
  ['tags', 'Tags'],
  ['medias', 'Médiathèque'],
  ['projets', 'Projets'],
  ['reglages', 'Réglages'],
] as const;

const SlotCtx = createContext<HTMLElement | null>(null);

/** Contenu de la barre supérieure (fil d'Ariane + actions), rendu par chaque écran. */
export function Topbar({ crumbs, children }: { crumbs: ReactNode[]; children?: ReactNode }) {
  const slot = useContext(SlotCtx);
  if (!slot) return null;
  return createPortal(
    <>
      <nav className="adm-crumbs" aria-label="Fil d'Ariane">
        {crumbs.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fil d'Ariane statique
          <span key={i}>
            {i > 0 && <span aria-hidden="true"> &gt; </span>}
            {c}
          </span>
        ))}
      </nav>
      {children && <div className="adm-top-actions">{children}</div>}
    </>,
    slot,
  );
}

export function Layout({
  section,
  editor,
  children,
}: {
  section: string;
  editor: Editor;
  children: ReactNode;
}) {
  const pb = usePb();
  const qc = useQueryClient();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const logout = () => {
    pb.authStore.clear();
    qc.clear();
    navigate('/admin/login', { replace: true });
  };
  return (
    <div className="adm">
      <a className="adm-skip" href="#adm-main">
        Aller au contenu
      </a>
      <div className="adm-brand">
        <Link to="/admin/billets">
          ND<sup>®</sup> / Console
        </Link>
      </div>
      <header className="adm-top" ref={setSlot} />
      <nav className="adm-nav" aria-label="Console">
        <ul>
          {NAV.map(([id, label], i) => (
            <li key={id}>
              <Link to={`/admin/${id}`} aria-current={section === id ? 'page' : undefined}>
                <span className="adm-nav-n" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {section === id && <span aria-hidden="true">&gt; </span>}
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="adm-session">
          <span className="adm-micro">Session</span>
          <span className="adm-session-who" title={editor.email}>
            {editor.name || editor.email}
          </span>
          <button type="button" className="adm-btn is-small" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </nav>
      <main id="adm-main" className="adm-main" tabIndex={-1}>
        <SlotCtx.Provider value={slot}>{children}</SlotCtx.Provider>
      </main>
    </div>
  );
}
