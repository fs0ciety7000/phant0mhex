import type { Post, PostStatus } from '@nd/pb-types';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Topbar } from '../Layout';
import { errorMessage, usePb } from '../lib/pb';
import { qk, useCategories } from '../lib/queries';
import { Link, navigate, setSearch, useSearch } from '../lib/router';
import { formatDate, pad } from '../lib/util';
import { useDialogs } from '../ui/Dialogs';
import { useToast } from '../ui/Toasts';

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmé',
  published: 'Publié',
};

const PER_PAGE = 20;

export function StatusBadge({ post }: { post: Pick<Post, 'status' | 'published_at'> }) {
  const live = post.status === 'published' && (!post.published_at || new Date(post.published_at.replace(' ', 'T')) <= new Date());
  const label = post.status === 'published' && !live ? 'Publié (à venir)' : STATUS_LABEL[post.status];
  return <span className={`adm-badge is-${post.status}${live ? ' is-live' : ''}`}>{label}</span>;
}

type Row = Pick<Post, 'id' | 'title' | 'slug' | 'status' | 'published_at' | 'updated' | 'category'> & {
  expand?: { category?: { name: string } };
};

export function PostsList() {
  const pb = usePb();
  const qc = useQueryClient();
  const toast = useToast();
  const dialogs = useDialogs();
  const sp = useSearch();
  const status = sp.get('status') ?? '';
  const cat = sp.get('cat') ?? '';
  const q = sp.get('q') ?? '';
  const page = Math.max(1, Number(sp.get('page') ?? 1) || 1);
  const [qInput, setQInput] = useState(q);
  const cats = useCategories();

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (qInput !== q) setSearch({ q: qInput, page: null });
    }, 300);
    return () => window.clearTimeout(t);
  }, [qInput, q]);

  const filter = [
    status && pb.filter('status = {:s}', { s: status }),
    cat && pb.filter('category = {:c}', { c: cat }),
    q && pb.filter('(title ~ {:q} || slug ~ {:q} || excerpt ~ {:q})', { q }),
  ]
    .filter(Boolean)
    .join(' && ');

  const list = useQuery({
    queryKey: [...qk.posts, { status, cat, q, page }],
    queryFn: () =>
      pb.collection('posts').getList<Row>(page, PER_PAGE, {
        filter,
        sort: '-updated',
        expand: 'category',
        fields: 'id,title,slug,status,published_at,updated,category,expand.category.name',
      }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => pb.collection('posts').delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.posts });
      toast('Billet supprimé.');
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  const duplicate = async (row: Row) => {
    try {
      const src = await pb.collection('posts').getOne(row.id);
      const suffix = Math.random().toString(36).slice(2, 6);
      const copy = await pb.collection('posts').create({
        title: `${src.title} (copie)`,
        slug: `${src.slug}-copie-${suffix}`.slice(0, 90),
        excerpt: src.excerpt,
        body: src.body,
        category: src.category,
        tags: src.tags,
        status: 'draft',
        published_at: '',
        seo_title: src.seo_title,
        seo_description: src.seo_description,
        featured: false,
      });
      qc.invalidateQueries({ queryKey: qk.posts });
      toast('Copie créée (brouillon, sans couverture).');
      navigate(`/admin/billets/${copy.id}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const askDelete = async (row: Row) => {
    const ok = await dialogs.confirm({
      title: 'Supprimer le billet',
      message: (
        <>
          Supprimer définitivement « <strong>{row.title || 'Sans titre'}</strong> » ? Cette action est irréversible.
          Pour simplement le retirer du site, repassez-le en brouillon.
        </>
      ),
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) remove.mutate(row.id);
  };

  const data = list.data;
  const total = data?.totalItems ?? 0;
  const pages = data?.totalPages ?? 1;

  return (
    <div className="adm-page">
      <Topbar crumbs={['Billets', `${pad(total)} entrées`]}>
        <Link className="adm-btn is-primary" to="/admin/billets/nouveau">
          + Nouveau billet
        </Link>
      </Topbar>
      <div className="adm-head">
        <h1 className="adm-h1">
          <span className="adm-accent">01 /</span> Billets
        </h1>
      </div>
      <div className="adm-filters" role="search" aria-label="Filtrer les billets">
        <label className="adm-field">
          <span>Recherche</span>
          <input type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Titre, slug…" />
        </label>
        <label className="adm-field">
          <span>Statut</span>
          <select value={status} onChange={(e) => setSearch({ status: e.target.value, page: null })}>
            <option value="">Tous</option>
            {(Object.keys(STATUS_LABEL) as PostStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="adm-field">
          <span>Catégorie</span>
          <select value={cat} onChange={(e) => setSearch({ cat: e.target.value, page: null })}>
            <option value="">Toutes</option>
            {cats.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {list.isError && (
        <p className="adm-error" role="alert">
          ⚠ {errorMessage(list.error)}
        </p>
      )}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <caption className="adm-sr">Liste des billets</caption>
          <thead>
            <tr>
              <th scope="col">Statut</th>
              <th scope="col">Titre</th>
              <th scope="col">Catégorie</th>
              <th scope="col">Publication</th>
              <th scope="col">Modifié</th>
              <th scope="col">
                <span className="adm-sr">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody aria-busy={list.isFetching}>
            {data?.items.map((row) => (
              <tr key={row.id}>
                <td>
                  <StatusBadge post={row} />
                </td>
                <td className="adm-td-title">
                  <Link to={`/admin/billets/${row.id}`}>{row.title || 'Sans titre'}</Link>
                  <small>/{row.slug}</small>
                </td>
                <td>{row.expand?.category?.name ?? '—'}</td>
                <td>{formatDate(row.published_at)}</td>
                <td>{formatDate(row.updated)}</td>
                <td className="adm-td-actions">
                  <Link className="adm-btn is-small" to={`/admin/billets/${row.id}`} aria-label={`Éditer ${row.title}`}>
                    Éditer
                  </Link>
                  <button
                    type="button"
                    className="adm-btn is-small"
                    onClick={() => duplicate(row)}
                    aria-label={`Dupliquer ${row.title}`}
                  >
                    Dupliquer
                  </button>
                  <button
                    type="button"
                    className="adm-btn is-small is-danger-ghost"
                    onClick={() => askDelete(row)}
                    aria-label={`Supprimer ${row.title}`}
                  >
                    Suppr.
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.items.length === 0 && <p className="adm-empty">[ Aucun billet ]</p>}
        {list.isPending && <p className="adm-empty">Chargement…</p>}
      </div>
      {pages > 1 && (
        <nav className="adm-pager" aria-label="Pagination">
          <button
            type="button"
            className="adm-btn is-small"
            disabled={page <= 1}
            onClick={() => setSearch({ page: page - 1 })}
          >
            &lt; Préc.
          </button>
          <span className="adm-micro">
            Page {pad(page)} / {pad(pages)}
          </span>
          <button
            type="button"
            className="adm-btn is-small"
            disabled={page >= pages}
            onClick={() => setSearch({ page: page + 1 })}
          >
            Suiv. &gt;
          </button>
        </nav>
      )}
    </div>
  );
}
