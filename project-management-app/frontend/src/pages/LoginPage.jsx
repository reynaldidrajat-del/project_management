import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '../logic/services/api';
import { login } from '../logic/services/authApi';
import { useUiStore } from '../store/uiStore';

const initialForm = {
  identifier: '',
  password: '',
};

// Halaman login awal aplikasi memakai user yang terdaftar di menu Team.
function LoginPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const setAuthenticatedUser = useUiStore((state) => state.setAuthenticatedUser);
  const showToast = useUiStore((state) => state.showToast);
  const fromPath = location.state?.from?.pathname || '/';

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError('');
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.identifier.trim()) {
      nextErrors.identifier = 'Masukkan nama atau email.';
    }

    if (!form.password) {
      nextErrors.password = 'Masukkan password.';
    }

    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const session = await login({
        identifier: form.identifier.trim(),
        password: form.password,
      });

      setAuthenticatedUser(session.user, session.token);
      showToast({ type: 'success', message: `Login sebagai ${session.user.name}.` });
      navigate(fromPath, { replace: true });
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef3f8] px-4 py-6 text-text-dark sm:py-10">
      <section className="grid w-full max-w-6xl overflow-hidden rounded-xl border border-border bg-white shadow-soft lg:min-h-[680px] lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="hidden flex-col justify-between bg-[#102033] p-8 text-white lg:flex" aria-hidden="true">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-sm font-black text-primary-dark shadow-sm">
                PG
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Planner Gantt</p>
                <p className="text-base font-bold leading-tight">Department Timeline Hub</p>
              </div>
            </div>

            <div className="mt-14 max-w-md">
              <p className="text-sm font-semibold text-blue-100">Project Control Center</p>
              <h1 className="mt-3 text-4xl font-bold leading-tight">Ruang kerja project lintas departemen.</h1>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Akses dashboard, task board, approval, dan Gantt monitoring dari satu workspace yang konsisten.
              </p>
            </div>

            <div className="mt-10 rounded-lg border border-white/10 bg-white/[0.07] p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">Timeline Review</p>
                  <p className="mt-1 text-xs text-slate-300">Plan, execute, approve, monitor</p>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-200">Live</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Planning', width: 'w-8/12', color: 'bg-blue-300' },
                  { label: 'Execution', width: 'w-10/12', color: 'bg-amber-300' },
                  { label: 'Lead Review', width: 'w-7/12', color: 'bg-emerald-300' },
                ].map((row) => (
                  <div key={row.label} className="rounded-lg bg-white/[0.08] p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-100">{row.label}</span>
                      <span className="text-slate-400">Gantt</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${row.color} ${row.width}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs font-bold text-slate-200">
            <div className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-3">Board</div>
            <div className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-3">List</div>
            <div className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-3">Gantt</div>
          </div>
        </aside>

        <div className="flex items-center justify-center px-5 py-8 sm:px-8 lg:px-14">
          <form className="w-full max-w-md" noValidate onSubmit={handleSubmit}>
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-sm font-black text-white shadow-sm">
                  PG
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Planner Gantt</p>
                  <p className="font-bold leading-tight">Department Timeline Hub</p>
                </div>
              </div>
            </div>

            <div>
              <p className="page-kicker">Secure Workspace</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Masuk ke aplikasi</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">Gunakan akun yang terdaftar di menu Team.</p>
            </div>

            {formError ? (
              <div className="mt-6 rounded-lg border border-danger/20 bg-red-50 px-3 py-2 text-sm font-semibold text-danger" role="alert">
                {formError}
              </div>
            ) : null}

            <div className="mt-6 grid gap-5">
              <div>
                <label className="label" htmlFor="login-identifier">
                  Nama atau Email
                </label>
                <input
                  autoComplete="username"
                  autoFocus
                  className={`field mt-1 h-11 ${errors.identifier ? 'field-error' : ''}`}
                  id="login-identifier"
                  placeholder="nama@perusahaan.com"
                  value={form.identifier}
                  onChange={(event) => updateField('identifier', event.target.value)}
                />
                {errors.identifier ? <p className="form-error">{errors.identifier}</p> : null}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="label" htmlFor="login-password">
                    Password
                  </label>
                  <button
                    aria-controls="login-password"
                    aria-pressed={showPassword}
                    className="text-xs font-bold text-primary transition hover:text-primary-dark"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  </button>
                </div>
                <input
                  autoComplete="current-password"
                  className={`field mt-1 h-11 ${errors.password ? 'field-error' : ''}`}
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                />
                {errors.password ? <p className="form-error">{errors.password}</p> : null}
              </div>

              <button className="btn-primary h-11 w-full" disabled={loading} type="submit">
                {loading ? 'Memproses...' : 'Masuk'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
