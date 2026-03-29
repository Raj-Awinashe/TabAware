import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  Shield,
  Plus,
  Trash2,
  RefreshCw,
  Globe,
  Clock3,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Ban,
  Activity,
  Sparkles,
  LogOut,
  RotateCcw,
  User,
  Lock,
  Mail,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from './services/api';
import { cn, formatDate, formatTime } from './lib/utils';

type StatusResponse = {
  windowMinutes: number;
  state: string;
  recommendation: string;
  metrics: {
    totalEvents: number;
    distractingEvents: number;
    activeTimeSeconds: number;
    distractingDomainsSeen: string[];
    productiveDomainsSeen: string[];
  };
};

type SummaryRow = {
  domain: string;
  count: number;
  distracting_count: number;
};

type RecentEvent = {
  id: number;
  timestamp: number;
  domain: string;
  title: string;
  event_type: string;
  is_distracting: number;
};

type BlockedSite = {
  id: number;
  domain: string;
};

type UserInfo = {
  id: number;
  email: string;
};

type SessionInfo = {
  id: number;
  started_at: number;
  ended_at?: number | null;
  is_active: number;
};

const TOKEN_KEY = 'TabAware_token';

function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setApiToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [blockedSites, setBlockedSites] = useState<BlockedSite[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [token, setToken] = useState<string | null>(getStoredToken());
  const [user, setUser] = useState<UserInfo | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [resettingSession, setResettingSession] = useState(false);

  async function loadDashboard(showRefresh = false) {
    try {
      setError('');

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [meRes, sessionRes, statusRes, summaryRes, eventsRes, blockedRes] =
        await Promise.all([
          api.getMe(),
          api.getCurrentSession(),
          api.getStatus(),
          api.getSummary(),
          api.getEvents(),
          api.getBlockedSites(),
        ]);

      setUser(meRes.data);
      setSession(sessionRes.data);
      setStatus(statusRes.data);
      setSummary(summaryRes.data || []);
      setRecentEvents(eventsRes.data || []);
      setBlockedSites(blockedRes.data || []);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);

      if (err?.response?.status === 401) {
        handleLogout();
        return;
      }

      setError('Could not load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const savedToken = getStoredToken();

    if (!savedToken) {
      setLoading(false);
      return;
    }

    setApiToken(savedToken);
    setToken(savedToken);
    loadDashboard();

    const timer = setInterval(() => {
      loadDashboard(true);
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  async function handleAuthSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Email and password are required.');
      return;
    }

    try {
      setAuthLoading(true);
      setAuthError('');

      const res =
        authMode === 'login'
          ? await api.login(authEmail.trim(), authPassword)
          : await api.signup(authEmail.trim(), authPassword);

      const nextToken = res?.token;

      if (!nextToken) {
        setAuthError('Token missing from server response.');
        return;
      }

      setStoredToken(nextToken);
      setApiToken(nextToken);
      setToken(nextToken);

      setAuthPassword('');
      await loadDashboard();
    } catch (err: any) {
      console.error(`Failed to ${authMode}:`, err);
      setAuthError(
        err?.response?.data?.error ||
          `Could not ${authMode === 'login' ? 'log in' : 'sign up'}.`
      );
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    setStoredToken(null);
    setApiToken(null);
    setToken(null);
    setUser(null);
    setSession(null);
    setStatus(null);
    setSummary([]);
    setRecentEvents([]);
    setBlockedSites([]);
    setLoading(false);
    setError('');
  }

  async function handleResetSession() {
    try {
      setResettingSession(true);
      setError('');

      await api.resetSession();
      await loadDashboard(true);
    } catch (err: any) {
      console.error('Failed to reset session:', err);
      setError(err?.response?.data?.error || 'Could not reset session.');
    } finally {
      setResettingSession(false);
    }
  }

  async function handleAddBlockedSite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!newDomain.trim()) return;

    try {
      setSubmitting(true);
      setError('');

      await api.addBlockedSite(newDomain);
      setNewDomain('');
      await loadDashboard(true);
    } catch (err: any) {
      console.error('Failed to add blocked site:', err);
      setError(err?.response?.data?.error || 'Could not add blocked site.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveBlockedSite(id: number) {
    try {
      setError('');
      await api.removeBlockedSite(id);
      await loadDashboard(true);
    } catch (err) {
      console.error('Failed to remove blocked site:', err);
      setError('Could not remove blocked site.');
    }
  }

  const distractionPercent = useMemo(() => {
    if (!status || !status.metrics.totalEvents) return 0;

    return Math.round(
      (status.metrics.distractingEvents / status.metrics.totalEvents) * 100
    );
  }, [status]);

  const productiveDomainCount =
    status?.metrics.productiveDomainsSeen?.length || 0;
  const distractingDomainCount =
    status?.metrics.distractingDomainsSeen?.length || 0;

  const chartData = useMemo(() => {
    return summary.slice(0, 6).map((row) => ({
      name: row.domain.length > 14 ? `${row.domain.slice(0, 14)}...` : row.domain,
      fullDomain: row.domain,
      events: Number(row.count || 0),
      distracting: Number(row.distracting_count || 0),
    }));
  }, [summary]);

  const pieData = useMemo(() => {
    const distracting = status?.metrics.distractingEvents || 0;
    const productive = Math.max(
      0,
      (status?.metrics.totalEvents || 0) - distracting
    );

    return [
      { name: 'Productive', value: productive },
      { name: 'Distracting', value: distracting },
    ];
  }, [status]);

  function getStateTone(state?: string) {
    switch (state) {
      case 'FOCUS':
        return {
          badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
          icon: <CheckCircle2 className="h-5 w-5" />,
          label: 'Focused',
          glow: 'from-emerald-500/20 to-emerald-400/5',
        };
      case 'UNFOCUSED':
        return {
          badge: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
          icon: <AlertTriangle className="h-5 w-5" />,
          label: 'Unfocused',
          glow: 'from-amber-500/20 to-amber-400/5',
        };
      case 'DISTRACTED':
        return {
          badge: 'bg-rose-500/15 text-rose-300 border-rose-400/20',
          icon: <AlertTriangle className="h-5 w-5" />,
          label: 'Distracted',
          glow: 'from-rose-500/20 to-rose-400/5',
        };
      default:
        return {
          badge: 'bg-slate-500/15 text-slate-300 border-slate-400/20',
          icon: <Clock3 className="h-5 w-5" />,
          label: 'Idle',
          glow: 'from-slate-500/20 to-slate-400/5',
        };
    }
  }

  const stateTone = getStateTone(status?.state);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
          <div className="grid w-full gap-8 lg:grid-cols-2">
            <div className="flex flex-col justify-center">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                <Sparkles className="h-4 w-4" />
                Focus tracking with sessions
              </div>

              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                TabAware
              </h1>

              <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                Log in to track your own sessions, manage blocked sites, and start fresh whenever you want with a reset session button.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <FeatureCard
                  icon={<Shield className="h-5 w-5" />}
                  title="Per-user blocking"
                  text="Each user gets their own blocked sites and activity data."
                />
                <FeatureCard
                  icon={<RotateCcw className="h-5 w-5" />}
                  title="Session reset"
                  text="Start a clean session whenever you want and separate your progress."
                />
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-slate-900 p-6 shadow-2xl">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  {authMode === 'login' ? (
                    <Lock className="h-6 w-6" />
                  ) : (
                    <User className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">
                    {authMode === 'login' ? 'Log in' : 'Create account'}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {authMode === 'login'
                      ? 'Access your dashboard and current session.'
                      : 'Create your own account to start tracking.'}
                  </p>
                </div>
              </div>

              {authError ? (
                <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {authError}
                </div>
              ) : null}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Email</label>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-transparent text-sm text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Password
                  </label>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3">
                    <Lock className="h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full bg-transparent text-sm text-white outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:opacity-90 disabled:opacity-60"
                >
                  {authLoading
                    ? authMode === 'login'
                      ? 'Logging in...'
                      : 'Creating account...'
                    : authMode === 'login'
                    ? 'Log in'
                    : 'Create account'}
                </button>
              </form>

              <button
                onClick={() =>
                  setAuthMode((prev) => (prev === 'login' ? 'signup' : 'login'))
                }
                className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10"
              >
                {authMode === 'login'
                  ? 'Need an account? Sign up'
                  : 'Already have an account? Log in'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="animate-pulse space-y-6">
            <div className="h-14 w-72 rounded-2xl bg-slate-800" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="h-36 rounded-3xl bg-slate-900" />
              <div className="h-36 rounded-3xl bg-slate-900" />
              <div className="h-36 rounded-3xl bg-slate-900" />
              <div className="h-36 rounded-3xl bg-slate-900" />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="h-[400px] rounded-3xl bg-slate-900 lg:col-span-2" />
              <div className="h-[400px] rounded-3xl bg-slate-900" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="relative mb-8 overflow-hidden rounded-[32px] border border-white/10 bg-slate-900 px-6 py-6 shadow-2xl">
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-br opacity-100',
              stateTone.glow
            )}
          />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                  <Sparkles className="h-4 w-4" />
                  Logged in and tracking current session
                </div>

                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                    <Shield className="h-7 w-7" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                      TabAware
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-slate-300 md:text-base">
                      Your account, your blocked sites, your current session.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <div
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold',
                    stateTone.badge
                  )}
                >
                  {stateTone.icon}
                  {stateTone.label}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => loadDashboard(true)}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-60"
                  >
                    <RefreshCw
                      className={cn('h-4 w-4', refreshing && 'animate-spin')}
                    />
                    Refresh
                  </button>

                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SessionMetaCard
                label="Logged in as"
                value={user?.email || 'Unknown user'}
              />
              <SessionMetaCard
                label="Current session"
                value={session ? `#${session.id}` : 'No session'}
              />
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Session started
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {session?.started_at
                    ? new Date(session.started_at).toLocaleString()
                    : 'Unknown'}
                </div>
                <button
                  onClick={handleResetSession}
                  disabled={resettingSession}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:opacity-90 disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" />
                  {resettingSession ? 'Resetting...' : 'Reset Session'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="Current state"
            value={stateTone.label}
            hint={status?.recommendation || 'No recommendation available.'}
          />

          <StatCard
            icon={<Clock3 className="h-5 w-5" />}
            label="Active time"
            value={formatTime(status?.metrics.activeTimeSeconds || 0)}
            hint={`Based on the last ${status?.windowMinutes || 5} minutes`}
          />

          <StatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Distracting activity"
            value={`${distractionPercent}%`}
            hint={`${status?.metrics.distractingEvents || 0} distracting events`}
          />

          <StatCard
            icon={<Globe className="h-5 w-5" />}
            label="Domains seen"
            value={`${productiveDomainCount + distractingDomainCount}`}
            hint={`${productiveDomainCount} productive, ${distractingDomainCount} distracting`}
          />
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-xl lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-slate-300">
                  <BarChart3 className="h-5 w-5" />
                  <span className="text-sm font-medium">Domain activity</span>
                </div>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Most visited domains
                </h2>
              </div>
            </div>

            {chartData.length === 0 ? (
              <EmptyState text="No domain activity yet." />
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '16px',
                        color: '#fff',
                      }}
                    />
                    <Bar dataKey="events" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center gap-2 text-slate-300">
              <Activity className="h-5 w-5" />
              <span className="text-sm font-medium">Focus split</span>
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Productive vs distracting
            </h2>

            {pieData.every((item) => item.value === 0) ? (
              <div className="mt-8">
                <EmptyState text="No recent events to visualize." />
              </div>
            ) : (
              <>
                <div className="mt-6 flex h-56 items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                      >
                        <Cell />
                        <Cell />
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#0f172a',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '16px',
                          color: '#fff',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid gap-3">
                  <LegendRow label="Productive events" value={pieData[0]?.value || 0} />
                  <LegendRow label="Distracting events" value={pieData[1]?.value || 0} />
                </div>
              </>
            )}
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-xl lg:col-span-2">
            <div className="mb-5 flex items-center gap-2 text-slate-300">
              <Clock3 className="h-5 w-5" />
              <span className="text-sm font-medium">Live feed</span>
            </div>
            <h2 className="mb-5 text-xl font-semibold text-white">Recent activity</h2>

            {recentEvents.length === 0 ? (
              <EmptyState text="No recent events yet." />
            ) : (
              <div className="space-y-3">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
                            event.is_distracting
                              ? 'bg-rose-500/15 text-rose-300'
                              : 'bg-emerald-500/15 text-emerald-300'
                          )}
                        >
                          {event.is_distracting ? 'Distracting' : 'Productive'}
                        </span>

                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
                          {event.event_type}
                        </span>
                      </div>

                      <div className="mt-3 truncate text-sm font-semibold text-white md:text-base">
                        {event.domain}
                      </div>

                      <div className="mt-1 truncate text-sm text-slate-400">
                        {event.title || 'Untitled tab'}
                      </div>
                    </div>

                    <div className="ml-4 shrink-0 text-xs text-slate-400">
                      {formatDate(event.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-xl">
              <div className="mb-5 flex items-center gap-2 text-slate-300">
                <Ban className="h-5 w-5" />
                <span className="text-sm font-medium">Blocking</span>
              </div>
              <h2 className="mb-5 text-xl font-semibold text-white">Blocked sites</h2>

              <form onSubmit={handleAddBlockedSite} className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="youtube.com"
                  className="flex-1 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-slate-500"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:opacity-90 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </form>

              {blockedSites.length === 0 ? (
                <EmptyState text="No blocked sites saved yet." compact />
              ) : (
                <div className="space-y-2">
                  {blockedSites.map((site) => (
                    <div
                      key={site.id}
                      className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-3 py-3"
                    >
                      <span className="truncate text-sm font-medium text-white">
                        {site.domain}
                      </span>

                      <button
                        onClick={() => handleRemoveBlockedSite(site.id)}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                        aria-label={`Remove ${site.domain}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-xl">
              <div className="mb-4 flex items-center gap-2 text-slate-300">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-medium">Session insight</span>
              </div>
              <h2 className="text-xl font-semibold text-white">
                Current session context
              </h2>

              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <p>
                  Reset Session ends the current session and immediately starts a new one.
                </p>
                <p>
                  Your dashboard should show only data tied to your current logged-in account and active session.
                </p>
                <p>
                  This makes it much easier to tell when a fresh session has started.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-900 p-5 shadow-xl">
      <div className="mb-3 flex items-center gap-2 text-slate-300">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-3xl font-bold tracking-tight text-white">{value}</div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{hint}</p>
    </div>
  );
}

function SessionMetaCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900 p-5">
      <div className="mb-3 flex items-center gap-2 text-slate-200">
        {icon}
        <span className="font-semibold">{title}</span>
      </div>
      <p className="text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}

function EmptyState({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-white/10 bg-white/5 text-sm text-slate-400',
        compact ? 'p-4' : 'p-6'
      )}
    >
      {text}
    </div>
  );
}

function LegendRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
      <span className="text-sm text-slate-300">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

export default App;