import type { Project } from '@nd/pb-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MarkdownEditor } from '../editor/MarkdownEditor';
import { Topbar } from '../Layout';
import { validateImage } from '../lib/media';
import { errorMessage, fileUrl, usePb } from '../lib/pb';
import { qk } from '../lib/queries';
import { Link, navigate } from '../lib/router';
import { formatDate, slugify } from '../lib/util';
import { useDialogs } from '../ui/Dialogs';
import { useToast } from '../ui/Toasts';

type Form = Pick<
  Project,
  'title' | 'slug' | 'role' | 'year' | 'url' | 'summary' | 'body' | 'order' | 'featured'
>;
const EMPTY: Form = {
  title: '',
  slug: '',
  role: '',
  year: '',
  url: '',
  summary: '',
  body: '',
  order: 0,
  featured: false,
};
const pick = (p: Project): Form => ({
  title: p.title,
  slug: p.slug,
  role: p.role,
  year: p.year,
  url: p.url,
  summary: p.summary,
  body: p.body,
  order: p.order,
  featured: p.featured,
});

export default function ProjectEditor({ param }: { param: string }) {
  const pb = usePb();
  const qc = useQueryClient();
  const toast = useToast();
  const dialogs = useDialogs();
  const isNew = param === 'nouveau';
  const q = useQuery({
    queryKey: qk.project(param),
    enabled: !isNew,
    queryFn: () => pb.collection('projects').getOne(param),
    staleTime: 0,
  });
  const [form, setForm] = useState<Form | null>(isNew ? EMPTY : null);
  const [record, setRecord] = useState<Project | null>(null);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const slugTouched = useRef(!isNew);
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    if (q.data && !formRef.current) {
      setForm(pick(q.data));
      setRecord(q.data);
    }
  }, [q.data]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setSaved(false);
    setForm((f) => {
      if (!f) return f;
      const n = { ...f, [k]: v };
      if (k === 'title' && !slugTouched.current) n.slug = slugify(String(v));
      return n;
    });
  };
  const onBody = useCallback((body: string) => {
    setForm((f) => {
      if (!f || f.body === body) return f;
      setSaved(false);
      return { ...f, body };
    });
  }, []);

  const save = useCallback(
    async (cover?: File | null) => {
      const f = formRef.current;
      if (!f) return;
      if (!f.title.trim()) return toast('Titre requis.', 'error');
      setBusy(true);
      try {
        const data: Record<string, unknown> = { ...f, slug: f.slug || slugify(f.title) };
        let body: FormData | Record<string, unknown> = data;
        if (cover !== undefined) {
          const fd = new FormData();
          for (const [k, v] of Object.entries(data)) fd.append(k, String(v));
          if (cover) fd.append('cover', cover);
          else fd.append('cover', '');
          body = fd;
        }
        const rec = record
          ? await pb.collection('projects').update(record.id, body)
          : await pb.collection('projects').create(body);
        setRecord(rec);
        setForm(pick(rec));
        setSaved(true);
        qc.invalidateQueries({ queryKey: qk.projects });
        toast('Projet enregistré.');
        if (!record) navigate(`/admin/projets/${rec.id}`, { replace: true });
      } catch (e) {
        toast(errorMessage(e), 'error');
      } finally {
        setBusy(false);
      }
    },
    [pb, qc, record, toast],
  );

  if (q.isError) return <p className="adm-error">⚠ {errorMessage(q.error)}</p>;
  if (!form) return <p className="adm-boot">Chargement du projet…</p>;

  return (
    <div className="adm-post">
      <Topbar
        crumbs={[
          <Link key="p" to="/admin/projets">
            Projets
          </Link>,
          record ? record.title : 'Nouveau',
          'Édition',
        ]}
      >
        <output className={`adm-save is-${saved ? 'saved' : 'dirty'}`}>
          {busy ? '⟳ Enregistrement…' : saved ? '● Enregistré' : '○ Non enregistré'}
        </output>
        <button type="button" className="adm-btn is-primary" onClick={() => save()} disabled={busy}>
          [ Enregistrer ] &gt;&gt;&gt;
        </button>
      </Topbar>
      <div className="adm-post-main">
        <div className="adm-post-fields">
          <label className="adm-field">
            <span>Titre</span>
            <input
              className="adm-title-input"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
            />
          </label>
          <div className="adm-grid-fields">
            <label className="adm-field">
              <span>Slug</span>
              <input
                value={form.slug}
                spellCheck={false}
                onChange={(e) => {
                  slugTouched.current = true;
                  set('slug', slugify(e.target.value));
                }}
              />
            </label>
            <label className="adm-field">
              <span>Rôle</span>
              <input value={form.role} onChange={(e) => set('role', e.target.value)} />
            </label>
            <label className="adm-field">
              <span>Année</span>
              <input value={form.year} onChange={(e) => set('year', e.target.value)} />
            </label>
            <label className="adm-field">
              <span>URL</span>
              <input
                type="url"
                value={form.url}
                onChange={(e) => set('url', e.target.value)}
                placeholder="https://"
              />
            </label>
          </div>
          <label className="adm-field">
            <span>Résumé</span>
            <textarea rows={2} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
          </label>
        </div>
        <MarkdownEditor
          value={form.body}
          onChange={onBody}
          onSave={() => save()}
          label="Corps du projet (Markdown)"
        />
      </div>
      <aside className="adm-post-aside" aria-label="Métadonnées du projet">
        <h2 className="adm-aside-h">[ Couverture ]</h2>
        <div className="adm-aside-sec">
          {record?.cover ? (
            <img
              className="adm-cover"
              src={fileUrl(pb, record as never, record.cover, '960x0')}
              alt="Couverture actuelle"
            />
          ) : (
            <div className="adm-cover is-empty" aria-hidden="true" />
          )}
          <div className="adm-row is-wrap">
            <label className="adm-btn adm-file">
              {record?.cover ? 'Remplacer l’image' : 'Choisir une image'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = '';
                  if (!file) return;
                  const err = validateImage(file);
                  if (err) toast(err, 'error');
                  else save(file);
                }}
              />
            </label>
            {record?.cover && (
              <button
                type="button"
                className="adm-btn is-danger-ghost"
                onClick={async () => {
                  if (await dialogs.confirm({ title: 'Retirer la couverture', message: 'Retirer l’image ?' }))
                    save(null);
                }}
              >
                Retirer
              </button>
            )}
          </div>
        </div>
        <h2 className="adm-aside-h">[ Affichage ]</h2>
        <div className="adm-aside-sec adm-stack">
          <label className="adm-field">
            <span>Ordre</span>
            <input
              type="number"
              value={form.order}
              onChange={(e) => set('order', Number(e.target.value) || 0)}
            />
          </label>
          <label className="adm-check">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => set('featured', e.target.checked)}
            />
            <span>Mis en avant</span>
          </label>
        </div>
        <h2 className="adm-aside-h">[ Méta ]</h2>
        <dl className="adm-meta">
          <dt>ID</dt>
          <dd>{record?.id ?? '—'}</dd>
          <dt>Créé</dt>
          <dd>{formatDate(record?.created)}</dd>
          <dt>Modifié</dt>
          <dd>{formatDate(record?.updated)}</dd>
        </dl>
      </aside>
    </div>
  );
}
