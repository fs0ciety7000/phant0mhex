import type { Category, Tag } from '@nd/pb-types';
import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Topbar } from '../Layout';
import { errorMessage, usePb } from '../lib/pb';
import { qk, reorder, useCategories, useTags } from '../lib/queries';
import { pad, slugify } from '../lib/util';
import { useDialogs } from '../ui/Dialogs';
import { useToast } from '../ui/Toasts';

type Kind = 'categories' | 'tags';

function Row({
  kind,
  item,
  index,
  count,
  onMove,
}: {
  kind: Kind;
  item: Category | Tag;
  index: number;
  count: number;
  onMove?: (i: number, dir: -1 | 1) => void;
}) {
  const pb = usePb();
  const qc = useQueryClient();
  const toast = useToast();
  const dialogs = useDialogs();
  const [name, setName] = useState(item.name);
  const [slug, setSlug] = useState(item.slug);
  const [desc, setDesc] = useState('description' in item ? item.description : '');
  const dirty =
    name !== item.name || slug !== item.slug || ('description' in item && desc !== item.description);
  const key = kind === 'categories' ? qk.categories : qk.tags;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const data: Record<string, string> = { name, slug: slug || slugify(name) };
      if (kind === 'categories') data.description = desc;
      await pb.collection(kind).update(item.id, data);
      qc.invalidateQueries({ queryKey: key });
      toast(`« ${name} » enregistré.`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  const remove = async () => {
    const used = await pb
      .collection('posts')
      .getList(1, 1, {
        filter:
          kind === 'categories'
            ? pb.filter('category = {:id}', { id: item.id })
            : pb.filter('tags ~ {:id}', { id: item.id }),
        fields: 'id',
      })
      .then((r) => r.totalItems)
      .catch(() => 0);
    const ok = await dialogs.confirm({
      title: 'Supprimer',
      message: `Supprimer « ${item.name} » ?${used ? ` ${used} billet(s) l’utilisent et le perdront.` : ''}`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await pb.collection(kind).delete(item.id);
      qc.invalidateQueries({ queryKey: key });
      toast('Supprimé.');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <li className="adm-tax-row">
      <form onSubmit={save} className="adm-tax-form">
        <span className="adm-tax-n adm-accent" aria-hidden="true">
          {pad(index + 1)}
        </span>
        <label className="adm-field">
          <span>Nom</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="adm-field">
          <span>Slug</span>
          <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} spellCheck={false} />
        </label>
        {kind === 'categories' && (
          <label className="adm-field is-grow">
            <span>Description</span>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
        )}
        <div className="adm-row adm-tax-actions">
          {onMove && (
            <>
              <button
                type="button"
                className="adm-btn is-square"
                aria-label={`Monter ${item.name}`}
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="adm-btn is-square"
                aria-label={`Descendre ${item.name}`}
                disabled={index === count - 1}
                onClick={() => onMove(index, 1)}
              >
                ↓
              </button>
            </>
          )}
          <button type="submit" className={`adm-btn${dirty ? ' is-primary' : ''}`} disabled={!dirty}>
            Enregistrer
          </button>
          <button
            type="button"
            className="adm-btn is-danger-ghost"
            onClick={remove}
            aria-label={`Supprimer ${item.name}`}
          >
            Suppr.
          </button>
        </div>
      </form>
    </li>
  );
}

function Taxonomy({ kind }: { kind: Kind }) {
  const pb = usePb();
  const qc = useQueryClient();
  const toast = useToast();
  const cats = useCategories();
  const tags = useTags();
  const q = kind === 'categories' ? cats : tags;
  const items = (q.data ?? []) as (Category | Tag)[];
  const [name, setName] = useState('');
  const title = kind === 'categories' ? 'Catégories' : 'Tags';
  const key = kind === 'categories' ? qk.categories : qk.tags;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const data: Record<string, unknown> = { name: name.trim(), slug: slugify(name) };
      if (kind === 'categories') {
        data.order = (cats.data ?? []).reduce((m, c) => Math.max(m, c.order), 0) + 1;
        data.description = '';
      }
      await pb.collection(kind).create(data);
      setName('');
      qc.invalidateQueries({ queryKey: key });
      toast(`« ${name.trim()} » créé.`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const move = async (i: number, dir: -1 | 1) => {
    const changes = reorder(cats.data ?? [], i, dir);
    try {
      await Promise.all(changes.map((c) => pb.collection('categories').update(c.id, { order: c.order })));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
    qc.invalidateQueries({ queryKey: qk.categories });
  };

  return (
    <div className="adm-page">
      <Topbar crumbs={[title, `${pad(items.length)} entrées`]} />
      <div className="adm-head">
        <h1 className="adm-h1">
          <span className="adm-accent">{kind === 'categories' ? '02 /' : '03 /'}</span> {title}
        </h1>
      </div>
      <form className="adm-inline-add" onSubmit={add}>
        <label className="adm-field is-grow">
          <span>{kind === 'categories' ? 'Nouvelle catégorie' : 'Nouveau tag'}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button type="submit" className="adm-btn is-primary">
          + Ajouter
        </button>
      </form>
      {q.isError && <p className="adm-error">⚠ {errorMessage(q.error)}</p>}
      <ol className="adm-tax">
        {items.map((it, i) => (
          <Row
            key={`${it.id}-${it.updated}`}
            kind={kind}
            item={it}
            index={i}
            count={items.length}
            onMove={kind === 'categories' ? move : undefined}
          />
        ))}
      </ol>
      {q.data && items.length === 0 && <p className="adm-empty">[ Vide ]</p>}
    </div>
  );
}

export function Categories() {
  return <Taxonomy kind="categories" />;
}
export function Tags() {
  return <Taxonomy kind="tags" />;
}
