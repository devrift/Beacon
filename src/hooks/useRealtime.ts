import { useEffect } from 'react';
import { IS_SUPABASE_CONFIGURED, supabase } from '../supabase';
import { useAppStore, type Channel, type Message } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';

const asMessage = (row: unknown) => row as Message;
const asChannel = (row: unknown) => row as Channel;

export function useRealtime(): void {
  const user = useAuthStore((s) => s.user);
  const channelId = useAppStore((s) => s.activeChannelId);

  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED || !user) return;
    useAppStore.getState().clearAppState();
    const appendChannel = (channel: Channel) =>
      useAppStore.setState((state) =>
        state.channels.some((item) => item.id === channel.id)
          ? state
          : { channels: [...state.channels, channel] },
      );

    const realtime = supabase
      .channel(`beacon-sync-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType !== 'DELETE') useAppStore.getState().addMessage(asMessage(payload.new));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'server_members', filter: `user_id=eq.${user.id}` }, () => {
        void useAppStore.getState().fetchUserServers(user.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, (payload) => {
        if (payload.eventType !== 'DELETE') appendChannel(asChannel(payload.new));
      })
      .subscribe();

    void useAppStore.getState().fetchUserServers(user.id);

    return () => {
      void supabase.removeChannel(realtime);
    };
  }, [user]);

  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED || !user || !channelId) return;
    let alive = true;
    void supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (!alive || error || !data) return;
        useAppStore.getState().setChannelMessages(channelId, data.map(asMessage));
      });
    return () => { alive = false; };
  }, [channelId, user]);
}
