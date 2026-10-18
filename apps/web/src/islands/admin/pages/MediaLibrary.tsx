import type { Media } from '@nd/pb-types';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAskMeta } from '../editor/useAskMeta';
import { Topbar } from '../Layout';
import { forgetMedia, mediaSnippet, rememberMedia, uploadMedia } from '../lib/media';
import { errorMessage, fileUrl, usePb } from '../lib/pb';
import { qk } from '../lib/queries';
import { formatDate, pad } from '../lib/util';
import { useDialogs } from '../ui/Dialogs';
import { useToast } from '../ui/Toasts';

const PER_PAGE = 36;

export function MediaLibrary() {
  const pb = usePb();
  const qc = useQueryClient();
  const toast = useToast();
  const dialogs = useDialogs();
  const askMeta = useAskMeta();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState<string>('');

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const list = useQuery({
    queryKey: [...qk.media, 'library', debounced, page],
    queryFn: async () => {
      const r = await pb.collection('media').getList(page, PER_PAGE, {
        sort: '-created',
        filter: debounced ? pb.filter('alt ~ {:q} || caption ~ {:q}', { q: debounced }) : '',
      });
      rememberMedia(...r.items);
      return r;
    },
    placeholderData: keepPreviousData,
  });

  const upload = async (files: File[]) => {
    for (const file of files) {
      const meta = await askMeta(file);
      if (!meta) continue;
      try {
        setProgress(`Envoi de ${file.name}… 0%`);
        await uploadMedia(pb, file, meta, (p) => setProgress(`Envoi de ${file.name}… ${p}%`));
        toast(`« ${meta.alt} » ajouté.`);
      } catch (e) {
        toast(errorMessage(e), 'error');
      }
    }
    setProgress('');
    qc.invalidateQueries({ queryKey: qk.media });
  };

  const edit = async (m: Media) => {
    const r = await dialogs.form({
      title: 'Modifier le média',
      image: fileUrl(pb, m, m.file, '480x0'),
      fields: [
        { name: 'alt', label: 'Texte alternatif', value: m.alt, required: true },
        { name: 'caption', label: 'Légende', value: m.caption },
      ],
      submitLabel: 'Enregistrer',
    });
    if (!r) return;
    try {
      const rec = await pb.collection('media').update(m.id, { alt: r.alt, caption: r.caption });
      rememberMedia(rec);
      qc.invalidateQueries({ queryKey: qk.media });
      toast('Média mis à jour.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const remove = async (m: Media) => {
    const needle = `media:${m.id}`;
    const [posts, projects, site] = await Promise.all([
      pb
        .collection('posts')
        .getFullList({ filter: pb.filter('body ~ {:n}', { n: needle }), fields: 'id,title' })
        .catch(() => []),
      pb
        .collection('projects')
        .getFullList({ filter: pb.filter('body ~ {:n}', { n: needle }), fields: 'id,title' })
        .catch(() => []),
      pb
        .collection('site')
        .getFullList({ filter: pb.filter('bio ~ {:n}', { n: needle }), fields: 'id' })
        .catch(() => []),
    ]);
    const refs = [
      ...posts.map((p) => `billet « ${p.title} »`),
      ...projects.map((p) => `projet « ${p.title} »`),
      ...site.map(() => 'réglages (bio)'),
    ];
    const ok = await dialogs.confirm({
      title: 'Supprimer le média',
      message: refs.length ? (
        <>
          <strong className="adm-accent">⚠ Ce média est utilisé</strong> par : {refs.join(', ')}. Le supprimer
          laissera une image manquante. Continuer ?
        </>
      ) : (
        `Supprimer « ${m.alt} » ? Il n’est référencé nulle part.`
      ),
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await pb.collection('media').delete(m.id);
      forgetMedia(m.id);
      qc.invalidateQueries({ queryKey: qk.media });
      toast('Média supprimé.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const copy = async (m: Media) => {
    try {
      await navigator.clipboard.writeText(mediaSnippet(m));
      toast('Snippet Markdown copié.');
    } catch {
      await dialogs.prompt('Copier le snippet', 'Markdown', mediaSnippet(m));
    }
  };

  const data = list.data;
  return (
    <div className="adm-page">
      <Topbar crumbs={['Médiathèque', `${pad(data?.totalItems ?? 0)} fichiers`]}>
        <label className="adm-btn is-primary adm-file">
          + Téléverser
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const files = [...(e.currentTarget.files ?? [])];
              e.currentTarget.value = '';
              if (files.length) upload(files);
            }}
          />
        </label>
      </Topbar>
      <div className="adm-head">
        <h1 className="adm-h1">
          <span className="adm-accent">04 /</span> Médiathèque
        </h1>
      </div>
      <search className="adm-filters" aria-label="Filtrer les médias">
        <label className="adm-field is-grow">
          <span>Recherche (alt, légende)</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </search>
      <p className="adm-micro adm-muted" role="status" aria-live="polite">
        {progress}
      </p>
      {list.isError && <p className="adm-error">⚠ {errorMessage(list.error)}</p>}
      <ul className="adm-media-grid">
        {data?.items.map((m) => (
          <li key={m.id} className="adm-media">
            <img
              src={fileUrl(pb, m, m.file, '480x0')}
              alt={m.alt}
              loading="lazy"
              width={m.width || undefined}
              height={m.height || undefined}
            />
            <div className="adm-media-meta">
              <strong>{m.alt}</strong>
              {m.caption && <span>{m.caption}</span>}
              <span className="adm-muted">
                {m.width}×{m.height} · {formatDate(m.created)}
              </span>
              <code>media:{m.id}</code>
            </div>
            <div className="adm-media-actions">
              <button type="button" className="adm-btn is-small" onClick={() => copy(m)}>
                Copier MD
              </button>
              <button
                type="button"
                className="adm-btn is-small"
                onClick={() => edit(m)}
                aria-label={`Modifier ${m.alt}`}
              >
                Modifier
              </button>
              <button
                type="button"
                className="adm-btn is-small is-danger-ghost"
                onClick={() => remove(m)}
                aria-label={`Supprimer ${m.alt}`}
              >
                Suppr.
              </button>
            </div>
          </li>
        ))}
      </ul>
      {data && data.items.length === 0 && <p className="adm-empty">[ Aucun média ]</p>}
      {(data?.totalPages ?? 1) > 1 && (
        <nav className="adm-pager" aria-label="Pagination">
          <button
            type="button"
            className="adm-btn is-small"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            &lt; Préc.
          </button>
          <span className="adm-micro">
            Page {pad(page)} / {pad(data?.totalPages ?? 1)}
          </span>
          <button
            type="button"
            className="adm-btn is-small"
            disabled={page >= (data?.totalPages ?? 1)}
            onClick={() => setPage(page + 1)}
          >
            Suiv. &gt;
          </button>
        </nav>
      )}
    </div>
  );
}
