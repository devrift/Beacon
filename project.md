# Beacon — Project Specification

> A lightweight, high-performance, real-time communication web client.
> **Not** a Discord skin. Beacon is its own product with its own identity.

---

## 1. Product Vision

Beacon is a **zero-cost, self-hosted group communication platform** built for small teams, communities, and friend groups who want something fast, private, and visually distinctive.

**Core principles:**
- **Speed over spectacle.** Instant page loads, zero-latency optimistic messaging, no loading spinners.
- **Owned identity.** NOT a Discord clone. Beacon should feel like a modern productivity tool (think Linear, Obsidian, Raycast) fused with a communication app. It should feel like a tool you *built*, not a skin you downloaded.
- **Self-hosted first.** All data lives in the user's own Supabase project. No third-party data harvesting.
- **Offline-resilient.** The app must never crash or white-screen if the backend is missing. It degrades gracefully to local-only mode.

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Build Tool | Vite | 8.x | Instant HMR, ESM-native dev server |
| UI Framework | React | 19.x | Component rendering |
| Language | TypeScript | 6.x | Type safety |
| Styling | Tailwind CSS | 4.x (via `@tailwindcss/vite`) | Utility-first CSS |
| Icons | lucide-react | 1.x | Consistent icon set |
| State Mgmt | Zustand | 5.x | Lightweight global store with `persist` middleware |
| Backend/DB | Supabase | 2.x (`@supabase/supabase-js`) | PostgreSQL, Realtime subscriptions, future Auth |
| Voice/WebRTC | PeerJS | 1.x | Peer-to-peer voice (mesh network over Google STUN) |

### Dev Dependencies
- `@vitejs/plugin-react` — React Fast Refresh
- `oxlint` — Fast linter
- TypeScript config split: `tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`

---

## 3. Design Philosophy — **NOT Discord**

### What to avoid
- ❌ The Discord 3-column layout with identical proportions (72px rail + 240px sidebar + fill)
- ❌ Discord's exact color values (#1e1f22, #2b2d31, #313338, #5865f2)
- ❌ Discord's exact component patterns (the pill-indicator hover, the rounded-full-to-rounded-2xl morph)
- ❌ Monospace cyberpunk jargon ("TELEMETRY", "DATA STREAMS", "OPERATOR")
- ❌ Generic "dark mode" zinc palettes copied from Shadcn templates

### What Beacon should feel like
- ✅ **Linear's spatial precision** — Clean geometry, sharp borders, high-contrast text hierarchy
- ✅ **Arc Browser's personality** — Colorful, playful, with user-customizable accent tones
- ✅ **Obsidian's density** — Information-rich without clutter, content-first
- ✅ **Raycast's command-driven UX** — `Ctrl+K` as a first-class navigation pattern, keyboard-centric
- ✅ **Figma's collaborative feel** — Avatar stacks, live cursors (future), presence that feels alive

### Design tokens (starting palette — agent should iterate)
```
Background:       hsl(240, 6%, 7%)     — #101014  (not pure black, slight blue undertone)
Surface 1:        hsl(240, 6%, 10%)    — #17171c
Surface 2:        hsl(240, 6%, 14%)    — #202028
Surface 3 (hover):hsl(240, 6%, 18%)   — #292930
Border:           hsl(240, 4%, 20%)    — #303036
Text Primary:     hsl(0, 0%, 93%)      — #ededed
Text Secondary:   hsl(240, 3%, 55%)    — #8a8a92
Text Muted:       hsl(240, 3%, 40%)    — #636369
Accent:           hsl(252, 87%, 64%)   — #7c5cfc  (rich violet-indigo, NOT Discord blurple)
Accent Hover:     hsl(252, 87%, 58%)   — #6b47fb
Success:          hsl(152, 60%, 52%)   — #3ecf8e
Warning:          hsl(38, 92%, 60%)    — #f0b940
Danger:           hsl(0, 72%, 58%)     — #e04848
```

### Typography
- **Primary font:** `Inter` loaded from Google Fonts, fallback to system `sans-serif`.
- **Monospace (timestamps, code):** `JetBrains Mono` or `Fira Code`, fallback to `monospace`.
- **Base size:** 14px body, 13px sidebar items, 12px metadata/timestamps, 11px category headers.
- **No all-caps monospace headers.** Use sentence-case or title-case with `font-semibold`.

---

## 4. Layout Architecture

Beacon uses a **3-region layout**, but it should NOT look like Discord's.

```
┌──────────────────────────────────────────────────────┐
│  ┌────┐ ┌──────────┐ ┌────────────────────┐ ┌─────┐ │
│  │    │ │          │ │                    │ │     │ │
│  │ S  │ │  Channel │ │   Message Feed     │ │ M   │ │
│  │ e  │ │  Nav     │ │   + Input          │ │ e   │ │
│  │ r  │ │          │ │                    │ │ m   │ │
│  │ v  │ │  ┌────┐  │ │                    │ │ b   │ │
│  │ e  │ │  │User│  │ │                    │ │ e   │ │
│  │ r  │ │  │Dock│  │ │                    │ │ r   │ │
│  │ s  │ │  └────┘  │ │                    │ │ s   │ │
│  └────┘ └──────────┘ └────────────────────┘ └─────┘ │
└──────────────────────────────────────────────────────┘
```

### Region 1: Server Switcher (far left, ~56-64px)
- Vertical icon strip
- Each server = a colored circle/square with 2-letter abbreviation
- Active server indicated by a left-edge bar or background highlight
- `+` button to create new server
- Home/DM button at the top

### Region 2: Channel Navigation (~220-240px)
- Server name header (clickable for server settings future)
- Collapsible category groups: "Text Channels", "Voice Channels"
- Each channel row: icon (# or speaker) + channel name
- Hover: subtle background shift
- Active: distinct background + bold text
- **Bottom-pinned user dock:** Avatar, username, status, mic/headphone/settings icons

### Region 3: Main Content (flex fill)
- **Header bar:** Channel name + icon, right-side toggle for members panel
- **Message feed:** Scrollable, auto-scrolls to bottom on new messages
- **Message input:** Rounded input bar with attachment button, text area, send button
- **Right panel (collapsible):** Member list grouped by Online/Offline

---

## 5. Entities & Data Model

### Servers
```typescript
interface Server {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  icon_color?: string;  // used for the server icon background
}
```

### Channels
```typescript
interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: 'TEXT' | 'VOICE';
}
```

### Messages
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

### Members
```typescript
interface Member {
  id: string;
  username: string;
  presence: 'online' | 'idle' | 'dnd' | 'offline';
  avatarColor: string;
  customStatus?: string;
}
```

### App User (local)
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

## 6. Current File Structure

```
c:\Beacon\
├── .env                          # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── index.html                    # Vite entry HTML
├── package.json                  # Dependencies (react 19, tailwind 4, zustand 5, supabase, peerjs)
├── vite.config.ts                # Vite + React + Tailwind plugin
├── tsconfig.json                 # Root TS config (references app + node)
├── tsconfig.app.json             # App-specific TS config
├── tsconfig.node.json            # Node-specific TS config
└── src/
    ├── main.tsx                  # React root mount
    ├── App.tsx                   # Root layout — mounts ServerRail, ChannelSidebar, ChatCanvas, all modals
    ├── index.css                 # Tailwind import + CSS custom properties + scrollbar + animation keyframes
    ├── supabase.ts               # Safe Supabase client with mock fallback (never crashes on missing creds)
    ├── lib/
    │   └── supabase.ts           # Re-exports from ../supabase.ts (legacy compat)
    ├── store/
    │   └── useAppStore.ts        # Zustand store — all types, state, actions, persist middleware
    └── components/
        ├── ServerRail.tsx        # Left server icon strip
        ├── ChannelSidebar.tsx    # Channel list + user dock
        ├── ChatCanvas.tsx        # Message feed + input + member sidebar container
        ├── MessageRow.tsx        # Individual message rendering with hover actions
        ├── MemberSidebar.tsx     # Right-side member list
        ├── SettingsModal.tsx     # Full-screen settings (profile, appearance, notifications)
        ├── CreateServerModal.tsx # Create server dialog
        ├── CreateChannelModal.tsx# Create channel dialog
        └── QuickSwitcher.tsx     # Ctrl+K omni-search modal
```

---

## 7. Key Behaviors (Must Preserve)

### Supabase Client Safety
`src/supabase.ts` validates env vars and falls back to a mock client that returns `{ data: [], error: null }` for all queries. **The app must never crash or white-screen when Supabase is unconfigured.**

### Optimistic Messaging
When the user sends a message, it is immediately added to the local Zustand store (with `crypto.randomUUID()` as a temp ID) and displayed in the feed BEFORE the Supabase insert resolves.

### Realtime Subscriptions
`ChatCanvas` subscribes to `postgres_changes` (INSERT on `messages` table filtered by `channel_id`) using `supabase.channel()`. The subscription is cleaned up on channel switch via `supabase.removeChannel()`.

### Zustand Persistence
User preferences (`appUser`, `compactMode`, `soundEnabled`, `fontSize`, `memberSidebarOpen`) are persisted to `localStorage` via Zustand's `persist` middleware with key `beacon-minimal-storage`.

### Quick Switcher
`Ctrl+K` / `Cmd+K` opens a search modal that filters servers and channels by name. Selecting a result navigates instantly.

---

## 8. What Needs to Be Built / Fixed

### Immediate — UI Redesign (HIGH PRIORITY)
The current UI is a near-exact visual copy of Discord (same colors, same proportions, same component shapes). **It must be redesigned with a distinct visual identity** following the design tokens and philosophy in Section 3.

Key areas to redesign:
1. **Color palette** — Replace zinc-800/900 Discord values with the HSL palette from Section 3.
2. **Server rail** — Give it its own shape language (not Discord's rounded-full → rounded-2xl morph).
3. **Channel sidebar** — Distinct hover/active states, unique typography treatment.
4. **Message rendering** — Unique avatar shapes, timestamp style, message grouping.
5. **Input area** — Distinctive command-bar feel, not Discord's grey box.
6. **Modals** — Clean, purpose-built dialogs. Not generic grey boxes.

### Planned Features (NOT YET IMPLEMENTED)
- **Voice channels via PeerJS** — PeerJS is installed but no voice UI exists yet. Need WebRTC mesh connecting users in VOICE channels.
- **Supabase Auth** — Email/password or magic link sign-in. Currently there is no auth; the app uses a hardcoded local user.
- **File uploads** — Attachment button exists but has no handler.
- **Threads / Replies** — Reply button exists in hover bar but has no functionality.
- **Emoji picker** — Only quick-reaction chips exist. No full emoji browser.
- **Server invites** — Invite codes are generated but there's no join-by-code flow.
- **Server/channel deletion & editing**
- **User roles / permissions**
- **Message editing**
- **Typing indicators**
- **Unread message counts / notifications**

---

## 9. Environment Setup

```bash
# 1. Install dependencies
cd c:\Beacon
npm install

# 2. Configure Supabase (optional — app runs in offline mock mode without this)
# Edit .env:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# 3. Start dev server
npm run dev
# → http://localhost:5173

# 4. Type check
npx tsc --noEmit

# 5. Lint
npm run lint

# 6. Build for production
npm run build
```

---

## 10. Supabase Database Schema (if using live backend)

```sql
-- Servers table
CREATE TABLE servers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  owner_id    TEXT NOT NULL,
  icon_color  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Channels table
CREATE TABLE channels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id  UUID REFERENCES servers(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('TEXT', 'VOICE')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Messages table
CREATE TABLE messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Realtime on messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- RLS policies (permissive for now)
ALTER TABLE servers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on servers"  ON servers  FOR ALL USING (true);
CREATE POLICY "Allow all on channels" ON channels FOR ALL USING (true);
CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true);
```
