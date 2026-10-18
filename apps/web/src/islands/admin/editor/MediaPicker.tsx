import type { Media } from '@nd/pb-types';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { rememberMedia } from '../lib/media';
import { errorMessage, fileUrl, usePb } from '../lib/pb';
import { qk } from '../lib/queries';
import { Modal } from '../ui/Dialogs';

/** Choix d'une image existante, ou envoi d'un nouveau fichier. */
export function MediaPicker({
  open,
  onClose,
  onPick,
  onFiles,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (m: Media) => void;
  onFiles: (files: File[]) => void;
}) {
  const pb = usePb();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 250);
    return () => window.clearTimeout(t);
  }, [q]);
  const list = useQuery({
    queryKey: [...qk.media, 'picker', debounced],
    enabled: open,
    queryFn: async () => {
      const res = await pb.collection('media').getList(1, 48, {
        sort: '-created',
        filter: debounced ? pb.filter('alt ~ {:q} || caption ~ {:q}', { q: debounced }) : '',
      });
      rememberMedia(...res.items);
      return res;
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Insérer une image" wide>
      <div className="adm-dialog-body">
        <div className="adm-row is-wrap">
          <label className="adm-field is-grow">
            <span>Rechercher (alt, légende)</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="adm-btn is-primary adm-file">
            Téléverser une image…
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = [...(e.currentTarget.files ?? [])];
                e.currentTarget.value = '';
                if (files.length) onFiles(files);
              }}
            />
          </label>
        </div>
        {list.isError && <p className="adm-error">⚠ {errorMessage(list.error)}</p>}
        <ul className="adm-picker">
          {list.data?.items.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m)} aria-label={`Insérer « ${m.alt} »`}>
                <img
                  src={fileUrl(pb, m, m.file, '480x0')}
                  alt=""
                  loading="lazy"
                  width={m.width || undefined}
                  height={m.height || undefined}
                />
                <span>{m.alt}</span>
              </button>
            </li>
          ))}
        </ul>
        {list.data?.items.length === 0 && <p className="adm-empty">[ Aucune image ]</p>}
      </div>
    </Modal>
  );
}
