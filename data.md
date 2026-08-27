# Beacon — Data Reference

> Complete reference of all data models, database schema, state management, and data flow patterns.

---

## 1. Supabase Configuration

### Environment Variables
```env
# c:\Beacon\.env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### Client Initialization (`src/supabase.ts`)
The Supabase client uses a **fail-safe pattern**:
1. Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from env.
2. Validates that the URL is a valid `http://` or `https://` URL and the key is non-empty and not a placeholder.
3. If valid → calls `createClient(url, key)` from `@supabase/supabase-js`.
4. If invalid or missing → returns a **mock client** that:
   - Returns `{ data: [], error: null }` for all queries.
   - Returns chainable no-op objects for `.from()`, `.select()`, `.insert()`, `.eq()`, etc.
   - Returns no-op channel objects for `.channel()`, `.on()`, `.subscribe()`.
   - Logs a `console.warn` with instructions on how to configure credentials.
   - **Never throws.** The app renders fully in offline/mock mode.

---

## 2. PostgreSQL Schema (Supabase)

### `servers` Table
```sql
CREATE TABLE servers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  owner_id    TEXT NOT NULL,
  icon_color  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### `channels` Table
```sql
CREATE TABLE channels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id  UUID REFERENCES servers(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('TEXT', 'VOICE')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `messages` Table
```sql
CREATE TABLE messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Realtime
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

### Row Level Security (permissive starter policies)
```sql
ALTER TABLE servers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on servers"  ON servers  FOR ALL USING (true);
CREATE POLICY "Allow all on channels" ON channels FOR ALL USING (true);
CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true);
```

---

## 3. TypeScript Interfaces (Frontend)

All types are defined in `src/store/useAppStore.ts`.

### `Server`
```typescript
interface Server {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  icon_color?: string;
}
```

### `Channel`
```typescript
interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: 'TEXT' | 'VOICE';
}
```

### `Message`
```typescript
interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  author_name?: string;
  author_color?: string;
  content: string;
  created_at: string;     // ISO 8601
  reactions?: Record<string, number>;
}
```

### `Member`
```typescript
interface Member {
  id: string;
  username: string;
  presence: 'online' | 'idle' | 'dnd' | 'offline';
  avatarColor: string;
  customStatus?: string;
}
```

### `AppUser` (local user state)
```typescript
interface AppUser {
  id: string;
  username: string;
  customStatus: string;
  presence: 'online' | 'idle' | 'dnd' | 'offline';
  avatarColor: string;
  theme: 'dark' | 'light';
}
```

---

## 4. Zustand Store (`src/store/useAppStore.ts`)

### State Shape
```typescript
interface AppState {
  // Current user
  appUser: AppUser;
  setAppUser: (partial: Partial<AppUser>) => void;

  // Settings (persisted to localStorage)
  compactMode: boolean;
  soundEnabled: boolean;
  fontSize: 'sm' | 'base';
  setCompactMode: (v: boolean) => void;
  setSoundEnabled: (v: boolean) => void;
  setFontSize: (v: 'sm' | 'base') => void;

  // Navigation
  activeServerId: string | null;       // null = home/DMs view
  setActiveServerId: (id: string | null) => void;  // also resets activeChannelId to null
  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;

  // Data collections
  servers: Server[];
  setServers: (s: Server[]) => void;
  addServer: (s: Server) => void;

  channels: Channel[];
  setChannels: (c: Channel[]) => void;
  addChannel: (c: Channel) => void;

  members: Member[];
  setMembers: (m: Member[]) => void;

  messages: Message[];
  setMessages: (m: Message[]) => void;
  addMessage: (m: Message) => void;
  removeMessage: (id: string) => void;
  addReaction: (msgId: string, emoji: string) => void;

  // UI modal flags
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  createServerOpen: boolean;
  setCreateServerOpen: (v: boolean) => void;
  createChannelOpen: boolean;
  setCreateChannelOpen: (v: boolean) => void;
  quickSwitcherOpen: boolean;
  setQuickSwitcherOpen: (v: boolean) => void;
  memberSidebarOpen: boolean;
  setMemberSidebarOpen: (v: boolean) => void;
}
```

### Persistence
Uses `zustand/middleware/persist` with:
- **Key:** `"beacon-minimal-storage"`
- **Partialize:** Only persists `appUser`, `compactMode`, `soundEnabled`, `fontSize`, `memberSidebarOpen`
- **Storage:** `localStorage` (default)

### Defaults
```typescript
const defaultUser: AppUser = {
  id: 'user-1',
  username: 'Alex',
  customStatus: 'Working on features',
  presence: 'online',
  avatarColor: '#6366f1',
  theme: 'dark',
};
```

---

## 5. Data Flow Patterns

### Message Sending (Optimistic)
```
User types message → presses Enter
  ↓
1. Generate temp ID via crypto.randomUUID()
2. Create optimistic Message object with temp ID, user info, content, now() timestamp
3. Call addMessage(optimistic) → immediately renders in feed
4. Reset input field
5. Async: supabase.from('messages').insert([{ channel_id, author_id, content }])
6. If insert fails → console.warn (message stays in local state)
```

### Message Receiving (Realtime)
```
On activeChannelId change:
  ↓
1. setMessages([]) — clear feed
2. Fetch initial: supabase.from('messages').select('*').eq('channel_id', id).order('created_at').limit(100)
3. Subscribe: supabase.channel(`stream_${id}`).on('postgres_changes', { event: INSERT, table: messages, filter: channel_id=eq.${id} })
4. On INSERT event → addMessage(payload.new)
5. On cleanup (channel switch) → supabase.removeChannel(subscription)
```

### Server/Channel Creation
```
User fills form → clicks Create
  ↓
1. Generate UUIDs for server + default channel
2. Generate random invite code
3. Async: supabase.from('servers').insert([server])
4. Async: supabase.from('channels').insert([channel])
5. addServer(server), addChannel(channel) → local state
6. setActiveServerId(serverId), setActiveChannelId(channelId)
7. Close modal
```

### Navigation
```
setActiveServerId(id)   → also sets activeChannelId = null
setActiveChannelId(id)  → triggers message fetch + realtime subscription in ChatCanvas useEffect
```

---

## 6. Bootstrap Data (Dev/Demo Mode)

`App.tsx` seeds the store on first mount with:

**Servers:**
| id | name | invite_code | icon_color |
|---|---|---|---|
| `server-design` | Design Team | design-123 | #6366f1 |
| `server-engineering` | Engineering | eng-456 | #10b981 |

**Channels:**
| id | server_id | name | type |
|---|---|---|---|
| `channel-general` | server-design | general | TEXT |
| `channel-2` | server-design | ui-feedback | TEXT |
| `channel-3` | server-design | Design Sync | VOICE |
| `channel-4` | server-engineering | architecture | TEXT |
| `channel-5` | server-engineering | Standup | VOICE |

**Members:**
| id | username | presence | avatarColor | customStatus |
|---|---|---|---|---|
| user-2 | Sarah | online | #10b981 | In a meeting |
| user-3 | David | idle | #f59e0b | BRB |
| user-4 | Elena | dnd | #ef4444 | — |
| user-5 | Marcus | offline | #71717a | — |
