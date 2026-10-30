import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Categories = { necessary: true; analytics: boolean; functional: boolean };
type ConsentChoice = 'all' | 'reject' | 'custom';
const CONSENT_COOKIE = 'internlog_consent_v1';
const POLICY_VERSION = '1.0-2026-10';

function readCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie.split('; ').find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(CONSENT_COOKIE.length + 1)) : null;
}

export function CookieConsent(): React.JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [customising, setCustomising] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [functional, setFunctional] = useState(false);

  useEffect(() => { setVisible(readCookie() === null); }, []);

  async function save(choice: ConsentChoice): Promise<void> {
    const categories: Categories = { necessary: true, analytics: choice === 'all' || (choice === 'custom' && analytics), functional: choice === 'all' || (choice === 'custom' && functional) };
    const value = JSON.stringify({ categories, policyVersion: POLICY_VERSION });
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    const { data } = await supabase.auth.getUser();
    const anonymousId = getAnonymousId();
    if (data.user) {
      await supabase.from('cookie_consents').update({ withdrawn_at: new Date().toISOString() }).eq('user_id', data.user.id).is('withdrawn_at', null);
    }
    const { error } = await supabase.from('cookie_consents').insert({ user_id: data.user?.id ?? null, anonymous_id: anonymousId, categories, policy_version: POLICY_VERSION, user_agent: navigator.userAgent });
    if (error) console.warn('Consent is stored locally; server receipt could not be saved.', error.message);
    setVisible(false);
  }

  async function withdraw(): Promise<void> {
    document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    const { data } = await supabase.auth.getUser();
    const anonymousId = getAnonymousId();
    const withdrawnAt = new Date().toISOString();
    if (data.user) {
      await supabase.from('cookie_consents').update({ withdrawn_at: withdrawnAt }).eq('user_id', data.user.id).is('withdrawn_at', null);
    }
    await supabase.from('cookie_consents').insert({ user_id: data.user?.id ?? null, anonymous_id: anonymousId, categories: { necessary: true, analytics: false, functional: false }, policy_version: POLICY_VERSION, user_agent: navigator.userAgent, withdrawn_at: withdrawnAt });
    setVisible(true);
  }

  if (!visible) return <button type="button" onClick={() => void withdraw()} className="fixed bottom-3 right-3 z-40 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold shadow dark:border-slate-700 dark:bg-slate-900">Withdraw / privacy choices</button>;
  return <aside aria-label="Cookie preferences" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"><h2 className="font-semibold">Your privacy choices</h2><p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">Essential cookies keep InternLog secure and working. Optional analytics and functional cookies help improve the service. You can change your choice later.</p>{customising && <div className="mt-3 space-y-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked disabled /> Essential (always active)</label><label className="flex items-center gap-2"><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /> Analytics</label><label className="flex items-center gap-2"><input type="checkbox" checked={functional} onChange={(event) => setFunctional(event.target.checked)} /> Functional</label></div>}<div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void save('all')} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Accept all</button><button onClick={() => void save('reject')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Reject non-essential</button><button onClick={() => customising ? void save('custom') : setCustomising(true)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">{customising ? 'Save choices' : 'Customise'}</button></div></aside>;
}

function getAnonymousId(): string {
  const key = 'internlog_anonymous_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}
