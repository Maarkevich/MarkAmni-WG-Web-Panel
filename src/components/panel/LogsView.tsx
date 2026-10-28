'use client';

// ============================================
// LogsView.tsx — журнал аудита
// ============================================
import { useCallback, useEffect, useState } from 'react';
import { ScrollText, RefreshCw } from 'lucide-react';
import { Card, CardHead, Btn, Badge, Empty, Spinner } from './bits';
import { api, fmtDateTime } from '@/lib/awg/client';

interface Event { ts: string; actor: string; action: string; details: string }

const ACTION_TONES: Record<string, 'green' | 'red' | 'amber' | 'cyan' | 'slate'> = {
  'auth.login': 'green',
  'auth.fail': 'red',
  'client.create': 'green',
  'client.delete': 'red',
  'client.disable': 'amber',
  'client.autodisable': 'amber',
  'client.enable': 'green',
  'server.apply': 'cyan',
  'server.restart': 'cyan',
  'server.rotkeys': 'red',
  'backup.restore': 'amber',
  'telegram.bind': 'green'
};

export default function LogsView({ toast }: { toast: (m: string, t?: 'success' | 'error' | 'info') => void }) {
  const [events, setEvents] = useState<Event[] | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ events: Event[] }>('/api/logs');
      setEvents(r.events);
    } catch (e) { toast((e as Error).message, 'error'); }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка журнала
    void load();
  }, [load]);

  return (
    <Card>
      <CardHead title="Журнал аудита" icon={<ScrollText className="w-4 h-4" />}
        sub="последние 600 событий"
        right={<Btn onClick={() => void load()}><RefreshCw className="w-3.5 h-3.5" /> Обновить</Btn>} />
      {!events ? (
        <div className="py-16 flex justify-center"><Spinner className="w-6 h-6" /></div>
      ) : events.length === 0 ? (
        <Empty icon={<ScrollText className="w-5 h-5" />} title="Событий пока нет" />
      ) : (
        <div className="divide-y divide-slate-800/60 max-h-[65vh] overflow-y-auto">
          {events.map((e, i) => (
            <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-slate-800/30 transition-colors">
              <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">{fmtDateTime(e.ts)}</span>
              <Badge tone={ACTION_TONES[e.action] || 'slate'}>{e.action}</Badge>
              <span className="text-[12px] text-slate-400">{e.actor}</span>
              {e.details && <span className="text-[12px] text-slate-300 truncate flex-1 min-w-[120px]">{e.details}</span>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
