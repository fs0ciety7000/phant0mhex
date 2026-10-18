import type { Project } from '@nd/pb-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Topbar } from '../Layout';
import { errorMessage, usePb } from '../lib/pb';
import { qk, reorder } from '../lib/queries';
import { Link } from '../lib/router';
import { formatDate, pad } from '../lib/util';
import { useDialogs } from '../ui/Dialogs';
import { useToast } from '../ui/Toasts';

type Row = Pick<Project, 'id' | 'title' | 'slug' | 'role' | 'year' | 'order' | 'featured' | 'updated'>;

export function ProjectsList() {
  const pb = usePb();
  const qc = useQueryClient();
  const toast = useToast();
  const dialogs = useDialogs();
  const list = useQuery({
    queryKey: qk.projects,
    queryFn: () =>
      pb
        .collection('projects')
        .getFullList<Row>({ sort: 'order,title', fields: 'id,title,slug,role,year,order,featured,updated' }),
  });
  const items = list.data ?? [];

  const move = async (i: number, dir: -1 | 1) => {
    try {
      await Promise.all(
        reorder(items, i, dir).map((c) => pb.collection('projects').update(c.id, { order: c.order })),
      );
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
    qc.invalidateQueries({ queryKey: qk.projects });
  };

  const remove = async (p: Row) => {
    const ok = await dialogs.confirm({
      title: 'Supprimer le projet',
      message: `Supprimer définitivement « ${p.title} » ?`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await pb.collection('projects').delete(p.id);
      qc.invalidateQueries({ queryKey: qk.projects });
      toast('Projet supprimé.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div className="adm-page">
      <Topbar crumbs={['Projets', `${pad(items.length)} entrées`]}>
        <Link className="adm-btn is-primary" to="/admin/projets/nouveau">
          + Nouveau projet
        </Link>
      </Topbar>
      <div className="adm-head">
        <h1 className="adm-h1">
          <span className="adm-accent">05 /</span> Projets
        </h1>
      </div>
      {list.isError && <p className="adm-error">⚠ {errorMessage(list.error)}</p>}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <caption className="adm-sr">Projets, dans l’ordre d’affichage</caption>
          <thead>
            <tr>
              <th scope="col">Ordre</th>
              <th scope="col">Titre</th>
              <th scope="col">Rôle</th>
              <th scope="col">Année</th>
              <th scope="col">Modifié</th>
              <th scope="col">
                <span className="adm-sr">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => (
              <tr key={p.id}>
                <td>
                  <span className="adm-row">
                    <button
                      type="button"
                      className="adm-btn is-square"
                      aria-label={`Monter ${p.title}`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="adm-btn is-square"
                      aria-label={`Descendre ${p.title}`}
                      disabled={i === items.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      ↓
                    </button>
                  </span>
                </td>
                <td className="adm-td-title">
                  <Link to={`/admin/projets/${p.id}`}>
                    {p.featured && <span className="adm-accent">★ </span>}
                    {p.title}
                  </Link>
                  <small>/{p.slug}</small>
                </td>
                <td>{p.role || '—'}</td>
                <td>{p.year || '—'}</td>
                <td>{formatDate(p.updated)}</td>
                <td className="adm-td-actions">
                  <Link className="adm-btn is-small" to={`/admin/projets/${p.id}`}>
                    Éditer
                  </Link>
                  <button
                    type="button"
                    className="adm-btn is-small is-danger-ghost"
                    onClick={() => remove(p)}
                  >
                    Suppr.
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data && items.length === 0 && <p className="adm-empty">[ Aucun projet ]</p>}
      </div>
    </div>
  );
}
