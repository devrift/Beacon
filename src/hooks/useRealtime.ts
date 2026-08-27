import { useEffect } from 'react';
import { IS_SUPABASE_CONFIGURED, supabase } from '../supabase';
import { useAppStore, type Channel, type Message, type Server } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';

const asMessage = (row: unknown) => row as Message;
const asChannel = (row: unknown) => row as Channel;

export function useRealtime(): void {
  const user = useAuthStore((s) => s.user);
  const channelId = useAppStore((s) => s.activeChannelId);

  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED || !user) return;
    let alive = true;
    useAppStore.setState({ servers: [], channels: [], members: [], messagesByChannel: {}, activeServerId: null, activeChannelId: null });
    const appendServer = (server: Server) =>
      useAppStore.setState((state) =>
        state.servers.some((item) => item.id === server.id)
          ? state
          : { servers: [...state.servers, server] },
      );
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, (payload) => {
        if (payload.eventType !== 'DELETE') appendServer(payload.new as Server);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, (payload) => {
        if (payload.eventType !== 'DELETE') appendChannel(asChannel(payload.new));
      })
      .subscribe();

    void supabase
      .from('servers')
      .select('*')
      .eq('owner_id', user.id)
      .then(async ({ data, error }) => {
        if (!alive || error) return;
        const servers = (data ?? []) as Server[];
        useAppStore.setState({ servers });
        const ids = servers.map((server) => server.id);
        if (ids.length === 0) return;
        const { data: channelData, error: channelError } = await supabase.from('channels').select('*').in('server_id', ids);
        if (!alive || channelError) return;
        useAppStore.setState({ channels: (channelData ?? []) as Channel[] });
      });

    return () => {
      alive = false;
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
