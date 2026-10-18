import { ClientResponseError } from 'pocketbase';
import { type FormEvent, useId, useRef, useState } from 'react';
import { errorMessage, usePb } from '../lib/pb';

type Step = { kind: 'password' } | { kind: 'otp'; mfaId: string; otpId: string; email: string };

/** Connexion éditeur : mot de passe puis, si la MFA est active (PB ≥ 0.23), code OTP envoyé par e-mail. */
export function Login() {
  const pb = usePb();
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const errId = useId();
  const otpRef = useRef<HTMLInputElement>(null);

  const onPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    setBusy(true);
    setError('');
    try {
      await pb.collection('editors').authWithPassword(email, password);
      // succès sans MFA : Routes redirige.
    } catch (err) {
      const mfaId = err instanceof ClientResponseError ? (err.response?.mfaId as string | undefined) : undefined;
      if (err instanceof ClientResponseError && err.status === 401 && mfaId) {
        try {
          const { otpId } = await pb.collection('editors').requestOTP(email);
          setStep({ kind: 'otp', mfaId, otpId, email });
          setInfo(`Code envoyé à ${email}.`);
          requestAnimationFrame(() => otpRef.current?.focus());
        } catch (e2) {
          setError(`Envoi du code impossible : ${errorMessage(e2)}`);
        }
      } else if (err instanceof ClientResponseError && err.status === 400) {
        setError('Identifiants invalides.');
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const onOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.kind !== 'otp') return;
    const code = String(new FormData(e.currentTarget).get('code') ?? '').trim();
    setBusy(true);
    setError('');
    try {
      await pb.collection('editors').authWithOTP(step.otpId, code, { mfaId: step.mfaId });
    } catch (err) {
      setError(err instanceof ClientResponseError && err.status === 400 ? 'Code invalide ou expiré.' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (step.kind !== 'otp') return;
    setBusy(true);
    try {
      const { otpId } = await pb.collection('editors').requestOTP(step.email);
      setStep({ ...step, otpId });
      setInfo(`Nouveau code envoyé à ${step.email}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <p className="adm-micro adm-muted">ND® / Console — Accès restreint</p>
        <h1 className="adm-login-title">Connexion</h1>
        <p className="adm-micro adm-muted">
          {step.kind === 'password' ? 'Étape 1/2 — identifiants éditeur' : 'Étape 2/2 — code à usage unique (MFA)'}
        </p>
        {step.kind === 'password' ? (
          <form onSubmit={onPassword} className="adm-stack" aria-describedby={error ? errId : undefined}>
            <label className="adm-field">
              <span>E-mail</span>
              <input name="email" type="email" autoComplete="username" required />
            </label>
            <label className="adm-field">
              <span>Mot de passe</span>
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button type="submit" className="adm-btn is-primary is-block" disabled={busy}>
              {busy ? 'Connexion…' : '[ Se connecter ] >>>'}
            </button>
          </form>
        ) : (
          <form onSubmit={onOtp} className="adm-stack" aria-describedby={error ? errId : undefined}>
            {info && (
              <p className="adm-micro" role="status">
                {info}
              </p>
            )}
            <label className="adm-field">
              <span>Code reçu par e-mail</span>
              <input
                ref={otpRef}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="[0-9A-Za-z]{4,12}"
              />
            </label>
            <button type="submit" className="adm-btn is-primary is-block" disabled={busy}>
              {busy ? 'Vérification…' : '[ Valider ] >>>'}
            </button>
            <div className="adm-row">
              <button type="button" className="adm-btn is-small" onClick={resend} disabled={busy}>
                Renvoyer le code
              </button>
              <button
                type="button"
                className="adm-btn is-small"
                onClick={() => {
                  setStep({ kind: 'password' });
                  setError('');
                  setInfo('');
                }}
              >
                Retour
              </button>
            </div>
          </form>
        )}
        {error && (
          <p id={errId} className="adm-error" role="alert">
            ⚠ {error}
          </p>
        )}
      </div>
    </div>
  );
}
