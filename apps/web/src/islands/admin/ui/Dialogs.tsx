// Dialogues natifs <dialog> (focus piégé par le navigateur, Échap = annuler, focus restauré à la fermeture).
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface FieldDef {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
  type?: 'text' | 'url' | 'textarea';
  hint?: string;
}

interface ConfirmOpts {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}
interface FormOpts {
  title: string;
  fields: FieldDef[];
  submitLabel?: string;
  image?: string;
  intro?: ReactNode;
}

type Req =
  | ({ kind: 'confirm'; key: number; resolve: (v: boolean) => void } & ConfirmOpts)
  | ({ kind: 'form'; key: number; resolve: (v: Record<string, string> | null) => void } & FormOpts);
type ReqInit = Req extends infer R ? (R extends Req ? Omit<R, 'key'> : never) : never;

interface DialogApi {
  confirm(o: ConfirmOpts): Promise<boolean>;
  form(o: FormOpts): Promise<Record<string, string> | null>;
  prompt(title: string, label: string, value?: string, type?: FieldDef['type']): Promise<string | null>;
}

const Ctx = createContext<DialogApi | null>(null);

export function useDialogs(): DialogApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('DialogProvider manquant');
  return c;
}

/** <dialog> modal générique, réutilisé par la médiathèque. */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const prev = useRef<Element | null>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      prev.current = document.activeElement;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCloseEv = () => {
      if (prev.current instanceof HTMLElement) prev.current.focus();
      onClose();
    };
    d.addEventListener('close', onCloseEv);
    return () => d.removeEventListener('close', onCloseEv);
  }, [onClose]);
  return (
    <dialog ref={ref} className={`adm-dialog${wide ? ' is-wide' : ''}`} aria-labelledby={titleId}>
      {open && (
        <>
          <header className="adm-dialog-head">
            <h2 id={titleId}>{title}</h2>
            <button
              type="button"
              className="adm-btn is-ghost"
              aria-label="Fermer"
              onClick={() => ref.current?.close()}
            >
              ×
            </button>
          </header>
          {children}
        </>
      )}
    </dialog>
  );
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Req | null>(null);
  const queue = useRef<Req[]>([]);
  const resultRef = useRef<unknown>(null);
  const seq = useRef(0);

  const current = useRef<Req | null>(null);

  const open = useCallback((init: ReqInit) => {
    const r = { ...init, key: ++seq.current } as Req;
    if (current.current) queue.current.push(r);
    else {
      current.current = r;
      setReq(r);
    }
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (o) => new Promise((resolve) => open({ kind: 'confirm', resolve, ...o })),
      form: (o) => new Promise((resolve) => open({ kind: 'form', resolve, ...o })),
      prompt: async (title, label, value = '', type = 'text') => {
        const r = await new Promise<Record<string, string> | null>((resolve) =>
          open({ kind: 'form', resolve, title, fields: [{ name: 'v', label, value, required: true, type }] }),
        );
        return r ? (r.v ?? '') : null;
      },
    }),
    [open],
  );

  const close = useCallback(() => {
    const cur = current.current;
    if (cur?.kind === 'confirm') cur.resolve(resultRef.current === true);
    else if (cur?.kind === 'form') cur.resolve((resultRef.current as Record<string, string> | null) ?? null);
    resultRef.current = null;
    current.current = queue.current.shift() ?? null;
    setReq(current.current);
  }, []);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!req) return;
    if (req.kind === 'confirm') resultRef.current = true;
    else {
      const fd = new FormData(e.currentTarget);
      const out: Record<string, string> = {};
      for (const f of req.fields) out[f.name] = String(fd.get(f.name) ?? '').trim();
      resultRef.current = out;
    }
    (e.currentTarget.closest('dialog') as HTMLDialogElement | null)?.close();
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <Modal key={req?.key ?? 0} open={!!req} onClose={close} title={req?.title ?? ''}>
        {req && (
          <form method="dialog" className="adm-dialog-body" onSubmit={submit}>
            {req.kind === 'confirm' ? (
              <div className="adm-dialog-msg">{req.message}</div>
            ) : (
              <>
                {req.intro && <div className="adm-dialog-msg">{req.intro}</div>}
                {req.image && <img className="adm-dialog-img" src={req.image} alt="" />}
                {req.fields.map((f, i) => (
                  // biome-ignore lint/a11y/noLabelWithoutControl: le contrôle (input ou textarea) est choisi dynamiquement
                  <label key={f.name} className="adm-field">
                    <span>
                      {f.label}
                      {f.required && <abbr title="obligatoire"> *</abbr>}
                    </span>
                    {f.type === 'textarea' ? (
                      <textarea name={f.name} defaultValue={f.value} required={f.required} rows={3} />
                    ) : (
                      <input
                        name={f.name}
                        type={f.type === 'url' ? 'url' : 'text'}
                        defaultValue={f.value}
                        required={f.required}
                        // biome-ignore lint/a11y/noAutofocus: premier champ d'un dialogue modal
                        autoFocus={i === 0}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    )}
                    {f.hint && <small>{f.hint}</small>}
                  </label>
                ))}
              </>
            )}
            <div className="adm-dialog-actions">
              <button
                type="button"
                className="adm-btn"
                onClick={(e) => (e.currentTarget.closest('dialog') as HTMLDialogElement | null)?.close()}
              >
                Annuler
              </button>
              <button
                type="submit"
                className={`adm-btn ${req.kind === 'confirm' && req.danger ? 'is-danger' : 'is-primary'}`}
                // biome-ignore lint/a11y/noAutofocus: action principale d'une confirmation
                autoFocus={req.kind === 'confirm'}
              >
                {req.kind === 'confirm' ? (req.confirmLabel ?? 'Confirmer') : (req.submitLabel ?? 'Valider')}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </Ctx.Provider>
  );
}
