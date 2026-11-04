import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface RealtimeSubscription {
  table: string;
  filter?: string;
}

export function useRealtimeReload(
  channelName: string,
  subscriptions: RealtimeSubscription[],
  onChange: () => void
) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const key = JSON.stringify(subscriptions);

  useEffect(() => {
    let channel = supabase.channel(channelName);
    for (const sub of JSON.parse(key) as RealtimeSubscription[]) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: sub.table, ...(sub.filter ? { filter: sub.filter } : {}) },
        () => onChangeRef.current()
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, key]);
}
