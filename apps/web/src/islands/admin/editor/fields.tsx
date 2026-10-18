import type { Category, Tag } from '@nd/pb-types';
import { useQueryClient } from '@tanstack/react-query';
import { type KeyboardEvent, useId, useState } from 'react';
import { errorMessage, usePb } from '../lib/pb';
import { qk, useCategories, useTags } from '../lib/queries';
import { slugify } from '../lib/util';
import { useDialogs } from '../ui/Dialogs';
import { useToast } from '../ui/Toasts';

const NEW = '__new__';

/** Sélecteur de catégorie avec création à la volée (« + Nouvelle catégorie… »). */
export function CategoryField({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const pb = usePb();
  const qc = useQueryClient();
  const dialogs = useDialogs();
  const toast = useToast();
  const cats = useCategories();

  const create = async () => {
    const name = await dialogs.prompt('Nouvelle catégorie', 'Nom de la catégorie');
    if (!name) return;
    try {
      const order = (cats.data?.reduce((m, c) => Math.max(m, c.order), 0) ?? 0) + 1;
      const rec = await pb
        .collection('categories')
        .create({ name, slug: slugify(name), order, description: '' });
      qc.setQueryData<Category[]>(qk.categories, (l) => [...(l ?? []), rec]);
      qc.invalidateQueries({ queryKey: qk.categories });
      onChange(rec.id);
      toast(`Catégorie « ${name} » créée.`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <label className="adm-field">
      <span>Catégorie</span>
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === NEW) create();
          else onChange(e.target.value);
        }}
      >
        <option value="">— Aucune —</option>
        {cats.data?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={NEW}>+ Nouvelle catégorie…</option>
      </select>
    </label>
  );
}

/** Tags multiples : saisie avec suggestions, Entrée ou virgule pour ajouter (création si inconnu). */
export function TagsField({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const pb = usePb();
  const qc = useQueryClient();
  const toast = useToast();
  const tags = useTags();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listId = useId();
  const inputId = useId();
  const byId = new Map((tags.data ?? []).map((t) => [t.id, t]));

  const add = async (raw: string) => {
    const name = raw.trim().replace(/,$/, '').trim();
    if (!name) return;
    const slug = slugify(name);
    const existing = tags.data?.find((t) => t.slug === slug || t.name.toLowerCase() === name.toLowerCase());
    setText('');
    if (existing) {
      if (!value.includes(existing.id)) onChange([...value, existing.id]);
      return;
    }
    setBusy(true);
    try {
      const rec = await pb.collection('tags').create({ name, slug });
      qc.setQueryData<Tag[]>(qk.tags, (l) => [...(l ?? []), rec]);
      qc.invalidateQueries({ queryKey: qk.tags });
      onChange([...value, rec.id]);
      toast(`Tag « ${name} » créé.`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="adm-field">
      <label htmlFor={inputId}>Tags</label>
      <div className="adm-tags">
        <ul className="adm-chips" aria-label="Tags sélectionnés">
          {value.map((id) => (
            <li key={id} className="adm-chip">
              {byId.get(id)?.name ?? id}
              <button
                type="button"
                aria-label={`Retirer le tag ${byId.get(id)?.name ?? id}`}
                onClick={() => onChange(value.filter((x) => x !== id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <input
          id={inputId}
          list={listId}
          value={text}
          disabled={busy}
          placeholder={value.length ? '' : 'Ajouter…'}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(',')) add(v);
            else setText(v);
          }}
          onKeyDown={onKey}
          onBlur={() => text.trim() && add(text)}
          aria-describedby={`${inputId}-h`}
        />
        <span id={`${inputId}-h`} className="adm-sr">
          Entrée ou virgule pour ajouter ; un tag inconnu est créé.
        </span>
        <datalist id={listId}>
          {tags.data
            ?.filter((t) => !value.includes(t.id))
            .map((t) => (
              <option key={t.id} value={t.name} />
            ))}
        </datalist>
      </div>
    </div>
  );
}
