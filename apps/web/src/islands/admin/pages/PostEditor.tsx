import type { Post, PostStatus } from '@nd/pb-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CategoryField, TagsField } from '../editor/fields';
import { MarkdownEditor } from '../editor/MarkdownEditor';
import { Topbar } from '../Layout';
import { validateImage } from '../lib/media';
import { errorMessage, fileUrl, usePb } from '../lib/pb';
import { qk } from '../lib/queries';
import { Link, navigate } from '../lib/router';
import {
  formatDate,
  localInputToPb,
  pad,
  parsePbDate,
  pbToLocalInput,
  slugify,
  store,
  toPbDate,
} from '../lib/util';
import { useDialogs } from '../ui/Dialogs';
import { useToast } from '../ui/Toasts';
import { STATUS_LABEL } from './PostsList';

interface Form {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category: string;
  tags: string[];
  status: PostStatus;
  published_at: string;
  seo_title: string;
  seo_description: string;
  featured: boolean;
}

const EMPTY: Form = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  category: '',
  tags: [],
  status: 'draft',
  published_at: '',
  seo_title: '',
  seo_description: '',
  featured: false,
};

interface Draft {
  form: Form;
  base: number;
  at: number;
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

function fromRecord(p: Post): Form {
  return {
    title: p.title ?? '',
    slug: p.slug ?? '',
    excerpt: p.excerpt ?? '',
    body: p.body ?? '',
    category: p.category ?? '',
    tags: p.tags ?? [],
    status: p.status ?? 'draft',
    published_at: p.published_at ?? '',
    seo_title: p.seo_title ?? '',
    seo_description: p.seo_description ?? '',
    featured: !!p.featured,
  };
}

const snap = (f: Form) => JSON.stringify(f);
const draftKey = (id: string | null) => `nd-admin:post:${id ?? 'new'}`;

function tomorrowNine(): string {
  const d = new Date(Date.now() + 86_400_000);
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(d);
  return localInputToPb(`${ymd}T09:00`);
}

/** Garde la même instance d'éditeur quand /billets/nouveau devient /billets/<id> après création. */
export default function PostEditorRoute({ param }: { param: string }) {
  const [key, setKey] = useState(param);
  const known = useRef(param);
  useEffect(() => {
    if (param !== known.current) {
      known.current = param;
      setKey(param);
    }
  }, [param]);
  const onCreated = useCallback((id: string) => {
    known.current = id;
    navigate(`/admin/billets/${id}`, { replace: true });
  }, []);
  return <PostEditor key={key} initialId={key === 'nouveau' ? null : key} onCreated={onCreated} />;
}

function PostEditor({ initialId, onCreated }: { initialId: string | null; onCreated: (id: string) => void }) {
  const pb = usePb();
  const qc = useQueryClient();
  const toast = useToast();
  const dialogs = useDialogs();
  const uid = useId();

  const server = useQuery({
    queryKey: qk.post(initialId ?? 'new'),
    enabled: !!initialId,
    queryFn: () => pb.collection('posts').getOne(initialId as string),
    staleTime: 0,
    gcTime: 0,
  });

  const [form, setForm] = useState<Form | null>(initialId ? null : EMPTY);
  const [record, setRecord] = useState<Post | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [errorText, setErrorText] = useState('');
  const [conflict, setConflict] = useState<number | null>(null);
  const [localDraft, setLocalDraft] = useState<Draft | null>(null);
  const [stats, setStats] = useState<{ words: number; minutes: number | null }>({ words: 0, minutes: null });

  const idRef = useRef<string | null>(initialId);
  const formRef = useRef<Form | null>(form);
  formRef.current = form;
  const savedSnap = useRef(snap(EMPTY));
  const baseRev = useRef(0);
  const slugTouched = useRef(false);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const queued = useRef(false);
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;

  // Initialisation (une fois) depuis le serveur ou le brouillon local d'un nouveau billet.
  useEffect(() => {
    if (initialId) return;
    const d = store.get<Draft>(draftKey(null));
    if (d && snap(d.form) !== snap(EMPTY)) setLocalDraft(d);
  }, [initialId]);

  useEffect(() => {
    const rec = server.data;
    if (!rec || formRef.current) return;
    const f = fromRecord(rec);
    setForm(f);
    setRecord(rec);
    savedSnap.current = snap(f);
    baseRev.current = rec.revision ?? 0;
    slugTouched.current = f.slug !== slugify(f.title) || f.status !== 'draft';
    const d = store.get<Draft>(draftKey(rec.id));
    if (d && snap(d.form) !== snap(f)) setLocalDraft(d);
  }, [server.data]);

  const persist = useCallback(
    async (
      override: Partial<Form> = {},
      opts: { force?: boolean; quiet?: boolean } = {},
    ): Promise<boolean> => {
      if (inFlight.current) {
        queued.current = true;
        await inFlight.current;
      }
      const cur = formRef.current;
      if (!cur) return false;
      const data: Form = { ...cur, ...override };
      if (!data.title.trim()) {
        setSaveState('error');
        setErrorText('Titre requis pour enregistrer.');
        if (!opts.quiet) toast('Donnez un titre au billet avant d’enregistrer.', 'error');
        return false;
      }
      const patch: Partial<Form> = { ...override };
      if (!data.slug) {
        data.slug = slugify(data.title);
        patch.slug = data.slug;
      }
      setSaveState('saving');
      const run = (async () => {
        try {
          let rec: Post;
          const id = idRef.current;
          if (!id) {
            rec = await pb.collection('posts').create({ ...data });
          } else {
            if (!opts.force) {
              const head = await pb.collection('posts').getOne(id, { fields: 'id,revision' });
              if ((head.revision ?? 0) > baseRev.current) {
                setConflict(head.revision);
                setSaveState('error');
                setErrorText('Conflit de révision.');
                return false;
              }
            }
            rec = await pb.collection('posts').update(id, { ...data });
          }
          baseRev.current = rec.revision ?? 0;
          setRecord(rec);
          // Le serveur peut normaliser (slug, date de publication) : on reprend ses valeurs.
          const serverSide: Partial<Form> = {
            slug: rec.slug,
            published_at: rec.published_at,
            status: rec.status,
          };
          const saved: Form = { ...data, ...serverSide };
          savedSnap.current = snap(saved);
          const latest = { ...(formRef.current ?? data), ...patch, ...serverSide };
          formRef.current = latest;
          setForm(latest);
          if (!id) {
            store.del(draftKey(null));
            idRef.current = rec.id;
            onCreated(rec.id);
          }
          if (snap(latest) === savedSnap.current) {
            setSaveState('saved');
            store.del(draftKey(rec.id));
          } else setSaveState('dirty');
          setErrorText('');
          qc.invalidateQueries({ queryKey: qk.posts });
          return true;
        } catch (e) {
          setSaveState('error');
          setErrorText(errorMessage(e));
          if (!opts.quiet) toast(`Enregistrement impossible : ${errorMessage(e)}`, 'error');
          return false;
        }
      })();
      inFlight.current = run;
      const ok = await run;
      inFlight.current = null;
      return ok;
    },
    [pb, qc, toast, onCreated],
  );

  const persistRef = useRef(persist);
  persistRef.current = persist;

  // Brouillon local immédiat + PATCH débouncé (2 s) si le billet existe déjà.
  useEffect(() => {
    if (!form) return;
    const dirty = snap(form) !== savedSnap.current;
    if (!dirty) return;
    store.set(draftKey(idRef.current), { form, base: baseRev.current, at: Date.now() } satisfies Draft);
    setSaveState((s) => (s === 'saving' ? s : conflictRef.current !== null ? 'error' : 'dirty'));
    if (!idRef.current || conflict !== null) return;
    const t = window.setTimeout(() => persistRef.current({}, { quiet: true }), 2000);
    return () => window.clearTimeout(t);
  }, [form, conflict]);

  // Requête en file pendant un enregistrement : relancée à la fin.
  useEffect(() => {
    if (saveState !== 'saving' && queued.current) {
      queued.current = false;
      if (form && snap(form) !== savedSnap.current && idRef.current && conflict === null) {
        persistRef.current({}, { quiet: true });
      }
    }
  }, [saveState, form, conflict]);

  // Avertit avant de quitter la page avec des modifications non envoyées.
  useEffect(() => {
    if (saveState === 'saved') return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [saveState]);

  // Navigation interne : on envoie ce qui reste (le brouillon local reste en filet de sécurité).
  useEffect(
    () => () => {
      const f = formRef.current;
      if (f && idRef.current && conflictRef.current === null && snap(f) !== savedSnap.current) {
        persistRef.current({}, { quiet: true });
      }
    },
    [],
  );

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => {
      if (!f) return f;
      const n = { ...f, [k]: v };
      if (k === 'title' && !slugTouched.current) n.slug = slugify(String(v));
      return n;
    });

  const onBody = useCallback(
    (body: string) => setForm((f) => (f && f.body !== body ? { ...f, body } : f)),
    [],
  );

  const save = useCallback(() => {
    persistRef.current().then((ok) => ok && toast('Billet enregistré.'));
  }, [toast]);

  const validate = (f: Form): string[] => {
    const errs: string[] = [];
    if (!f.title.trim()) errs.push('titre');
    if (!(f.slug || slugify(f.title))) errs.push('slug');
    if (!f.body.trim()) errs.push('corps du billet');
    if (f.status === 'scheduled') {
      const d = parsePbDate(f.published_at);
      if (!d || d.getTime() <= Date.now()) errs.push('date de publication future (billet programmé)');
    }
    return errs;
  };

  const publish = async () => {
    const f = formRef.current;
    if (!f) return;
    if (conflict !== null) {
      toast('Résolvez d’abord le conflit de révision.', 'error');
      return;
    }
    const errs = validate(f);
    if (errs.length) {
      toast(`Impossible de publier — manquant : ${errs.join(', ')}.`, 'error');
      return;
    }
    const override: Partial<Form> =
      f.status === 'scheduled'
        ? {}
        : { status: 'published', published_at: f.published_at || toPbDate(new Date()) };
    const ok = await persistRef.current(override);
    if (ok) {
      toast(
        f.status === 'scheduled'
          ? `Billet programmé pour le ${formatDate(f.published_at)}.`
          : f.status === 'published'
            ? 'Billet mis à jour.'
            : 'Billet publié.',
      );
    }
  };

  const cycleStatus = async () => {
    const f = formRef.current;
    if (!f) return;
    if (f.status === 'draft') {
      const d = parsePbDate(f.published_at);
      setForm({
        ...f,
        status: 'scheduled',
        published_at: d && d.getTime() > Date.now() ? f.published_at : tomorrowNine(),
      });
      toast('Statut : programmé. Ajustez la date puis cliquez sur Programmer.');
    } else if (f.status === 'scheduled') {
      setForm({ ...f, status: 'draft' });
    } else {
      const ok = await dialogs.confirm({
        title: 'Dépublier',
        message: 'Repasser ce billet en brouillon ? Il disparaîtra du site.',
        confirmLabel: 'Dépublier',
        danger: true,
      });
      if (ok) setForm({ ...f, status: 'draft' });
    }
  };

  const keepMine = () => {
    if (conflict === null) return;
    baseRev.current = conflict;
    setConflict(null);
    persistRef.current({}, { force: true }).then((ok) => ok && toast('Votre version a été enregistrée.'));
  };

  const reload = async () => {
    const id = idRef.current;
    if (!id) return;
    try {
      const rec = await pb.collection('posts').getOne(id);
      const f = fromRecord(rec);
      savedSnap.current = snap(f);
      baseRev.current = rec.revision ?? 0;
      formRef.current = f;
      setForm(f);
      setRecord(rec);
      store.del(draftKey(id));
      setConflict(null);
      setSaveState('saved');
      toast('Version serveur rechargée.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const uploadCover = async (file: File) => {
    const err = validateImage(file);
    if (err) return toast(err, 'error');
    if (!idRef.current && !(await persistRef.current())) return;
    const id = idRef.current as string;
    try {
      const fd = new FormData();
      fd.append('cover', file);
      const rec = await pb.collection('posts').update(id, fd);
      baseRev.current = rec.revision ?? baseRev.current;
      setRecord(rec);
      toast('Couverture mise à jour.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const removeCover = async () => {
    const id = idRef.current;
    if (!id) return;
    const ok = await dialogs.confirm({
      title: 'Retirer la couverture',
      message: 'Retirer l’image de couverture ?',
    });
    if (!ok) return;
    try {
      const rec = await pb.collection('posts').update(id, { cover: null });
      baseRev.current = rec.revision ?? baseRev.current;
      setRecord(rec);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  if (server.isError) {
    return (
      <div className="adm-page">
        <Topbar
          crumbs={[
            <Link key="b" to="/admin/billets">
              Billets
            </Link>,
            'Erreur',
          ]}
        />
        <p className="adm-error" role="alert">
          ⚠ {errorMessage(server.error)}
        </p>
      </div>
    );
  }
  if (!form) {
    return (
      <p className="adm-boot" role="status">
        Chargement du billet…
      </p>
    );
  }

  const id = idRef.current;
  const saveLabel =
    conflict !== null
      ? '⚠ Conflit'
      : saveState === 'saved'
        ? id
          ? '● Enregistré'
          : '○ Non enregistré'
        : saveState === 'saving'
          ? '⟳ Enregistrement…'
          : saveState === 'error'
            ? '⚠ Erreur'
            : id
              ? '○ Non enregistré'
              : '○ Brouillon local';
  const publishLabel =
    form.status === 'scheduled'
      ? '[ Programmer ] >>>'
      : form.status === 'published'
        ? '[ Mettre à jour ] >>>'
        : '[ Publier ] >>>';

  return (
    <div className="adm-post">
      <Topbar
        crumbs={[
          <Link key="b" to="/admin/billets">
            Billets
          </Link>,
          id ? `LOG-${id.slice(0, 6).toUpperCase()}` : 'Nouveau',
          'Édition',
        ]}
      >
        <output
          className={`adm-save is-${conflict !== null ? 'error' : saveState}`}
          title={errorText || undefined}
        >
          {saveLabel}
        </output>
        <button type="button" className="adm-btn" onClick={save}>
          Enregistrer
        </button>
        <button
          type="button"
          className="adm-btn"
          onClick={cycleStatus}
          aria-label={`Statut : ${STATUS_LABEL[form.status]} — changer`}
        >
          Statut : {STATUS_LABEL[form.status]}
        </button>
        <button type="button" className="adm-btn is-primary" onClick={publish}>
          {publishLabel}
        </button>
      </Topbar>

      <div className="adm-post-main">
        {conflict !== null && (
          <div className="adm-banner is-alert" role="alert">
            <span>
              ⚠ Conflit : ce billet a été modifié ailleurs (révision serveur {pad(conflict)} &gt; locale{' '}
              {pad(baseRev.current)}). L’enregistrement automatique est suspendu.
            </span>
            <span className="adm-row">
              <button type="button" className="adm-btn is-small" onClick={keepMine}>
                Garder ma version
              </button>
              <button type="button" className="adm-btn is-small" onClick={reload}>
                Recharger
              </button>
            </span>
          </div>
        )}
        {localDraft && (
          <div className="adm-banner" role="status">
            <span>Brouillon local non synchronisé du {new Date(localDraft.at).toLocaleString('fr-BE')}.</span>
            <span className="adm-row">
              <button
                type="button"
                className="adm-btn is-small"
                onClick={() => {
                  setForm(localDraft.form);
                  slugTouched.current = true;
                  setLocalDraft(null);
                }}
              >
                Restaurer
              </button>
              <button
                type="button"
                className="adm-btn is-small"
                onClick={() => {
                  store.del(draftKey(id));
                  setLocalDraft(null);
                }}
              >
                Ignorer
              </button>
            </span>
          </div>
        )}

        <div className="adm-post-fields">
          <label className="adm-field">
            <span>Titre</span>
            <input
              className="adm-title-input"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Titre du billet"
              required
            />
          </label>
          <div className="adm-grid-fields">
            <label className="adm-field">
              <span>Slug</span>
              <input
                value={form.slug}
                onChange={(e) => {
                  slugTouched.current = true;
                  set(
                    'slug',
                    slugify(e.target.value.replace(/\s/g, '-')) + (e.target.value.endsWith('-') ? '-' : ''),
                  );
                }}
                spellCheck={false}
              />
            </label>
            <CategoryField value={form.category} onChange={(v) => set('category', v)} />
            <TagsField value={form.tags} onChange={(v) => set('tags', v)} />
            <label className="adm-field">
              <span>Publication (Bruxelles)</span>
              <input
                type="datetime-local"
                value={pbToLocalInput(form.published_at)}
                onChange={(e) => set('published_at', e.target.value ? localInputToPb(e.target.value) : '')}
              />
            </label>
          </div>
        </div>

        <MarkdownEditor
          value={form.body}
          onChange={onBody}
          onSave={save}
          label="Corps du billet (Markdown)"
          postId={id ?? undefined}
          onStats={setStats}
        />
      </div>

      <aside className="adm-post-aside" aria-label="Métadonnées">
        <h2 className="adm-aside-h">[ Couverture ]</h2>
        <div className="adm-aside-sec">
          {record?.cover ? (
            <img
              className="adm-cover"
              src={fileUrl(pb, record, record.cover, '960x0')}
              alt="Couverture actuelle"
              width={16}
              height={9}
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
                  const f = e.currentTarget.files?.[0];
                  e.currentTarget.value = '';
                  if (f) uploadCover(f);
                }}
              />
            </label>
            {record?.cover && (
              <button type="button" className="adm-btn is-danger-ghost" onClick={removeCover}>
                Retirer
              </button>
            )}
          </div>
        </div>

        <h2 className="adm-aside-h">[ SEO ]</h2>
        <div className="adm-aside-sec adm-stack">
          <label className="adm-field">
            <span>
              Extrait <small>{form.excerpt.length}/300</small>
            </span>
            <textarea
              rows={4}
              maxLength={300}
              value={form.excerpt}
              onChange={(e) => set('excerpt', e.target.value)}
            />
          </label>
          <label className="adm-field">
            <span>
              Titre SEO <small>{form.seo_title.length}/70</small>
            </span>
            <input
              value={form.seo_title}
              maxLength={70}
              placeholder={form.title}
              onChange={(e) => set('seo_title', e.target.value)}
            />
          </label>
          <label className="adm-field">
            <span>
              Description SEO <small>{form.seo_description.length}/160</small>
            </span>
            <textarea
              rows={3}
              maxLength={160}
              value={form.seo_description}
              placeholder={form.excerpt}
              onChange={(e) => set('seo_description', e.target.value)}
            />
          </label>
          <label className="adm-check" htmlFor={`${uid}-feat`}>
            <input
              id={`${uid}-feat`}
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
          <dd>{id ?? '—'}</dd>
          <dt>Révision</dt>
          <dd>{record ? pad(record.revision ?? 0) : '—'}</dd>
          <dt>Mots</dt>
          <dd>{stats.words}</dd>
          <dt>Lecture</dt>
          <dd>{stats.minutes ?? '—'} min</dd>
          <dt>Créé</dt>
          <dd>{formatDate(record?.created)}</dd>
          <dt>Modifié</dt>
          <dd>{formatDate(record?.updated)}</dd>
          <dt>Image OG</dt>
          <dd>auto-générée</dd>
          <dt>URL</dt>
          <dd>{form.slug ? `/journal/${form.slug}` : '—'}</dd>
        </dl>
      </aside>
    </div>
  );
}
