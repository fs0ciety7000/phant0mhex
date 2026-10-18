import type { Site, Social } from '@nd/pb-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MarkdownEditor } from '../editor/MarkdownEditor';
import { Topbar } from '../Layout';
import { errorMessage, usePb } from '../lib/pb';
import { qk } from '../lib/queries';
import { useToast } from '../ui/Toasts';

type Form = Pick<Site, 'bio' | 'email' | 'availability' | 'base'> & { socials: Social[] };

/** Réglages du site : ligne unique `site` (mise à jour seulement). */
export default function Settings() {
  const pb = usePb();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: qk.site,
    queryFn: async () => (await pb.collection('site').getList(1, 1)).items[0] ?? null,
    staleTime: 0,
  });
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    if (q.data && !formRef.current) {
      const s = q.data;
      setForm({
        bio: s.bio ?? '',
        email: s.email ?? '',
        availability: s.availability ?? '',
        base: s.base ?? '',
        socials: Array.isArray(s.socials) ? s.socials : [],
      });
    }
  }, [q.data]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setSaved(false);
    setForm((f) => (f ? { ...f, [k]: v } : f));
  };
  const onBio = useCallback((bio: string) => {
    setForm((f) => {
      if (!f || f.bio === bio) return f;
      setSaved(false);
      return { ...f, bio };
    });
  }, []);
  const setSocial = (i: number, patch: Partial<Social>) =>
    set(
      'socials',
      (form?.socials ?? []).map((s, j) => (j === i ? { ...s, ...patch } : s)),
    );
  const moveSocial = (i: number, dir: -1 | 1) => {
    const l = [...(form?.socials ?? [])];
    const j = i + dir;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j] as Social, l[i] as Social];
    set('socials', l);
  };

  const save = useCallback(async () => {
    const f = formRef.current;
    const id = q.data?.id;
    if (!f || !id) return;
    setBusy(true);
    try {
      const socials = f.socials.filter((s) => s.label.trim() || s.url.trim());
      await pb.collection('site').update(id, { ...f, socials });
      setSaved(true);
      qc.invalidateQueries({ queryKey: qk.site });
      toast('Réglages enregistrés.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }, [pb, qc, q.data, toast]);

  if (q.isError) return <p className="adm-error">⚠ {errorMessage(q.error)}</p>;
  if (q.data === null)
    return <p className="adm-error">⚠ Ligne « site » absente : vérifiez les migrations.</p>;
  if (!form) return <p className="adm-boot">Chargement des réglages…</p>;

  return (
    <div className="adm-page">
      <Topbar crumbs={['Réglages', 'Site']}>
        <output className={`adm-save is-${saved ? 'saved' : 'dirty'}`}>
          {busy ? '⟳ Enregistrement…' : saved ? '● Enregistré' : '○ Non enregistré'}
        </output>
        <button type="button" className="adm-btn is-primary" onClick={save} disabled={busy}>
          [ Enregistrer ] &gt;&gt;&gt;
        </button>
      </Topbar>
      <div className="adm-head">
        <h1 className="adm-h1">
          <span className="adm-accent">06 /</span> Réglages
        </h1>
      </div>
      <div className="adm-grid-fields adm-pad">
        <label className="adm-field">
          <span>E-mail de contact</span>
          <input value={form.email} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label className="adm-field">
          <span>Disponibilité</span>
          <input value={form.availability} onChange={(e) => set('availability', e.target.value)} />
        </label>
        <label className="adm-field">
          <span>Base</span>
          <input value={form.base} onChange={(e) => set('base', e.target.value)} />
        </label>
      </div>
      <fieldset className="adm-socials adm-pad">
        <legend className="adm-micro adm-muted">Liens (réseaux)</legend>
        {form.socials.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: liste éditable sans identifiant
          <div key={i} className="adm-social-row">
            <label className="adm-field">
              <span>Libellé</span>
              <input value={s.label} onChange={(e) => setSocial(i, { label: e.target.value })} />
            </label>
            <label className="adm-field is-grow">
              <span>URL</span>
              <input type="url" value={s.url} onChange={(e) => setSocial(i, { url: e.target.value })} />
            </label>
            <span className="adm-row">
              <button
                type="button"
                className="adm-btn is-square"
                aria-label={`Monter ${s.label || 'le lien'}`}
                disabled={i === 0}
                onClick={() => moveSocial(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="adm-btn is-square"
                aria-label={`Descendre ${s.label || 'le lien'}`}
                disabled={i === form.socials.length - 1}
                onClick={() => moveSocial(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="adm-btn is-square is-danger-ghost"
                aria-label={`Retirer ${s.label || 'le lien'}`}
                onClick={() =>
                  set(
                    'socials',
                    form.socials.filter((_, j) => j !== i),
                  )
                }
              >
                ×
              </button>
            </span>
          </div>
        ))}
        <button
          type="button"
          className="adm-btn"
          onClick={() => set('socials', [...form.socials, { label: '', url: '' }])}
        >
          + Ajouter un lien
        </button>
      </fieldset>
      <div className="adm-pad">
        <p className="adm-micro adm-muted">Bio (Markdown)</p>
      </div>
      <MarkdownEditor value={form.bio} onChange={onBio} onSave={save} label="Bio (Markdown)" />
    </div>
  );
}
