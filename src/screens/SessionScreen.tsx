import { SearchX } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Header } from '../components/Header';
import { LiveSession } from '../components/LiveSession';
import { SettlementView } from '../components/SettlementView';
import { Button, EmptyState } from '../components/ui';
import { navigate } from '../lib/router';

const goBack = () => (window.history.length > 1 ? window.history.back() : navigate('/calendar'));

export function SessionScreen({ id }: { id?: string }) {
  const { getSession } = useData();
  const session = id ? getSession(id) : undefined;

  if (!session)
    return (
      <>
        <Header title="משחק" back={goBack} />
        <EmptyState
          icon={<SearchX size={30} />}
          title="המשחק לא נמצא"
          text="ייתכן שהוא נמחק, או שהקישור שגוי."
          action={<Button onClick={() => navigate('/calendar')}>חזרה ליומן</Button>}
        />
      </>
    );

  return session.phase === 'active' ? <LiveSession session={session} back={goBack} /> : <SettlementView session={session} back={goBack} />;
}
