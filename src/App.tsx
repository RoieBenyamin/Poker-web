import { useEffect } from 'react';
import { useData } from './data/DataContext';
import { navigate, useRoute } from './lib/router';
import { BottomNav, type TabKey } from './components/BottomNav';
import { CalendarScreen } from './screens/CalendarScreen';
import { ActiveTableScreen } from './screens/ActiveTableScreen';
import { SessionScreen } from './screens/SessionScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { DebtsScreen } from './screens/DebtsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { GroupsScreen } from './screens/GroupsScreen';
import { GoogleSignInScreen } from './screens/GoogleSignInScreen';

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <img src="/icon.svg" alt="" className="h-20 w-20 animate-pulse rounded-3xl" />
      <p className="text-slate-400">טוען את השולחן…</p>
    </div>
  );
}

export default function App() {
  const { ready, authReady, authUser, error, mode, me, meId, getSession, groups } = useData();
  const route = useRoute();
  const [section, param] = route;

  // Default route
  useEffect(() => {
    if (!section) navigate(groups.length ? '/calendar' : '/groups');
  }, [section, groups.length]);

  if (mode === 'firebase' && !authReady) return <Splash />;
  if (mode === 'firebase' && !authUser) return <GoogleSignInScreen />;
  if (!ready) return <Splash />;
  if (error && !mode) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5">
        <div className="max-w-md rounded-3xl border border-red-500/30 bg-slate-900 p-5 text-center">
          <h1 className="text-xl font-bold text-red-300">לא ניתן להתחבר לשירות הנתונים</h1>
          <p className="mt-2 break-words text-sm text-slate-300">{error}</p>
          <p className="mt-3 text-xs text-slate-500">בדקו את הגדרות Firebase ואת ספק Google בפרויקט.</p>
        </div>
      </div>
    );
  }
  if (mode === 'firebase' && authUser && !me) {
    return error
      ? <GoogleSignInScreen />
      : <Splash />;
  }
  if (!meId || !me) return <GoogleSignInScreen />;

  let screen;
  let tab: TabKey = 'calendar';
  switch (section) {
    case 'groups':
      screen = <GroupsScreen />;
      tab = 'groups';
      break;
    case 'table':
      screen = <ActiveTableScreen />;
      tab = 'table';
      break;
    case 'session': {
      screen = <SessionScreen id={param} />;
      tab = getSession(param)?.phase === 'active' ? 'table' : 'calendar';
      break;
    }
    case 'me':
      screen = <DashboardScreen playerId={me.id} />;
      tab = 'me';
      break;
    case 'player':
      screen = <DashboardScreen playerId={param} />;
      tab = param === me.id ? 'me' : 'debts';
      break;
    case 'debts':
      screen = <DebtsScreen />;
      tab = 'debts';
      break;
    case 'settings':
      screen = <SettingsScreen />;
      tab = 'me';
      break;
    default:
      screen = <CalendarScreen />;
      tab = 'calendar';
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      {error && <div role="status" className="mx-4 mt-2 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div>}
      <main className="pb-nav">{screen}</main>
      <BottomNav active={tab} />
    </div>
  );
}
