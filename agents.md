# Beacon — Agent Tasks

> Structured task breakdown for AI coding agents (Codex, Claude, etc.).
> Each task is self-contained with context, files to modify, acceptance criteria, and constraints.

---

## Prerequisites for All Tasks

- **Stack:** Vite 8 + React 19 + TypeScript 6 + Tailwind CSS 4 + Zustand 5 + Supabase JS 2 + Lucide React + PeerJS
- **Read first:** `project.md` (full spec), `data.md` (data models & flows)
- **Type check:** Run `npx tsc --noEmit` after every task. Zero errors required.
- **Dev server:** Run `npm run dev` to verify no runtime crashes. The app must render fully even without Supabase credentials.
- **Do NOT use placeholder comments** like `// TODO` or `// implement later`. Every function body must be complete.

---

## TASK 1 — Visual Identity Redesign (CRITICAL)

### Problem
The current UI is a near-exact copy of Discord's layout and color scheme. It uses Discord's zinc-800/900 palette, identical proportions, and the same component patterns. It must be redesigned into something visually unique.

### Design Direction
Read `project.md` Section 3 ("Design Philosophy — NOT Discord") for the full spec. Key points:

**Color palette (use these exact HSL values):**
```
Background:        #101014  hsl(240, 6%, 7%)
Surface 1:         #17171c  hsl(240, 6%, 10%)
Surface 2:         #202028  hsl(240, 6%, 14%)
Surface 3 (hover): #292930  hsl(240, 6%, 18%)
Border:            #303036  hsl(240, 4%, 20%)
Text Primary:      #ededed  hsl(0, 0%, 93%)
Text Secondary:    #8a8a92  hsl(240, 3%, 55%)
Text Muted:        #636369  hsl(240, 3%, 40%)
Accent:            #7c5cfc  hsl(252, 87%, 64%)  — rich violet-indigo
Accent Hover:      #6b47fb  hsl(252, 87%, 58%)
Success:           #3ecf8e
Warning:           #f0b940
Danger:            #e04848
```

**Typography:**
- Load `Inter` from Google Fonts in `index.html`. Fallback: system sans-serif.
- Body text: 14px. Sidebar items: 13px. Metadata/timestamps: 12px. Category headers: 11px.
- No all-caps monospace. Use sentence-case or title-case with `font-semibold`.

**Visual distinctiveness requirements:**
- The server rail must NOT use Discord's rounded-full → rounded-2xl hover morph. Use a different shape language (e.g., always rounded-xl with a colored left border for active, or a subtle background glow).
- The channel sidebar hover/active states must feel different from Discord. Consider left-edge colored bars, or background gradient shifts.
- Message avatars can be rounded-lg squares instead of circles to differentiate.
- The input area should feel like a command bar (like Raycast/Spotlight), not a grey Discord text box. Consider a bottom border accent, or a floating capsule shape.
- Modals should have a slight frosted glass feel with `backdrop-blur`.

### Files to Modify
| File | What to Change |
|---|---|
| `index.html` | Add Google Fonts `<link>` for Inter |
| `src/index.css` | Replace all color values, update CSS variables, update scrollbar colors, update `.clean-input` |
| `src/components/ServerRail.tsx` | Restyle with new palette + unique shape language |
| `src/components/ChannelSidebar.tsx` | Restyle with new palette + unique hover/active states |
| `src/components/ChatCanvas.tsx` | Restyle header, message feed area, and input bar |
| `src/components/MessageRow.tsx` | Restyle avatar shapes, text colors, hover action bar |
| `src/components/MemberSidebar.tsx` | Restyle with new palette |
| `src/components/SettingsModal.tsx` | Restyle with new palette + frosted glass backdrop |
| `src/components/CreateServerModal.tsx` | Restyle with new palette |
| `src/components/CreateChannelModal.tsx` | Restyle with new palette |
| `src/components/QuickSwitcher.tsx` | Restyle with new palette |

### Acceptance Criteria
- [ ] No Discord color values remain (#1e1f22, #2b2d31, #313338, #5865f2, or the current #18181b, #27272a, #121214, #6366f1)
- [ ] No all-caps monospace text anywhere in the UI
- [ ] The app is visually distinguishable from Discord in a side-by-side screenshot comparison
- [ ] The Inter font is loaded and applied
- [ ] All interactive elements have clear hover/active/focus states
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] The app renders without crashes in both online and offline (mock) Supabase modes

---

## TASK 2 — Supabase Authentication

### Problem
There is no authentication. The app uses a hardcoded local user object. Anyone can send messages as "Alex".

### Requirements
1. Add a login/signup page that renders when no Supabase session exists.
2. Use Supabase Auth with email + password sign-up/sign-in.
3. On successful auth, populate `appUser` from the Supabase user metadata.
4. Guard the main app layout behind an auth check.
5. Add a "Sign Out" button in SettingsModal.
6. Update message sending to use the authenticated user's ID and display name.

### Files to Create/Modify
| File | Action |
|---|---|
| `src/components/AuthPage.tsx` | **CREATE** — Login/signup form with email + password |
| `src/App.tsx` | **MODIFY** — Add auth state check; render AuthPage if not signed in |
| `src/store/useAppStore.ts` | **MODIFY** — Update `AppUser` to sync from Supabase auth user |
| `src/components/SettingsModal.tsx` | **MODIFY** — Add sign-out button |
| `src/components/ChatCanvas.tsx` | **MODIFY** — Use auth user ID for message sending |

### Acceptance Criteria
- [ ] New users can sign up with email + password
- [ ] Existing users can sign in
- [ ] Unauthenticated users see only the auth page
- [ ] Messages are attributed to the authenticated user
- [ ] Sign-out works and returns to auth page
- [ ] App still functions in mock mode (no Supabase) — show a "Demo Mode" banner instead of auth page

---

## TASK 3 — Voice Channels (PeerJS WebRTC)

### Problem
PeerJS is installed (`"peerjs": "^1.5.5"`) but there is no voice implementation. Voice channels show a placeholder message.

### Requirements
1. When a user clicks a VOICE channel, they "join" the voice room.
2. Use PeerJS to create a mesh network between all users in the same voice channel.
3. Show connected users as a list of avatars with their names and a "speaking" indicator.
4. Add mute/deafen toggle buttons.
5. Add a "Disconnect" button to leave the voice channel.
6. Use Google's public STUN servers: `stun:stun.l.google.com:19302`.

### Files to Create/Modify
| File | Action |
|---|---|
| `src/hooks/useVoice.ts` | **CREATE** — Custom hook managing PeerJS connection, media streams, peer mesh |
| `src/components/VoicePanel.tsx` | **CREATE** — Voice channel UI (connected users, mute/deafen/disconnect) |
| `src/components/ChatCanvas.tsx` | **MODIFY** — Replace voice placeholder with `<VoicePanel />` |
| `src/store/useAppStore.ts` | **MODIFY** — Add `voiceChannelId`, `isMuted`, `isDeafened` state |

### Acceptance Criteria
- [ ] Users can join a voice channel by clicking it
- [ ] Audio streams are connected between peers in the same channel
- [ ] Mute/deafen toggles work
- [ ] Disconnect button leaves the voice channel
- [ ] Voice state is reflected in the UI (connected user list, speaking indicators)
- [ ] PeerJS errors are handled gracefully (no crashes)

---

## TASK 4 — File Uploads & Attachments

### Problem
The attachment button (PlusCircle icon) in the message input exists but has no handler.

### Requirements
1. Clicking the attachment button opens a file picker.
2. Upload the file to Supabase Storage (bucket: `attachments`).
3. Insert a message with the file URL embedded.
4. Render image attachments inline in the message feed.
5. Render non-image attachments as downloadable file cards (filename + size + download icon).

### Files to Create/Modify
| File | Action |
|---|---|
| `src/components/ChatCanvas.tsx` | **MODIFY** — Wire attachment button to file picker + upload logic |
| `src/components/MessageRow.tsx` | **MODIFY** — Detect and render file URLs / image embeds |
| `src/store/useAppStore.ts` | **MODIFY** — Add `attachments?: string[]` to Message interface |

### Acceptance Criteria
- [ ] File picker opens on attachment button click
- [ ] Files are uploaded to Supabase Storage
- [ ] Image files render inline as `<img>` with max-width constraint
- [ ] Non-image files render as downloadable cards
- [ ] Upload progress or loading state is shown
- [ ] Offline mode: show error toast, don't crash

---

## TASK 5 — Message Threads & Replies

### Problem
The reply button in MessageRow's hover bar exists but has no functionality.

### Requirements
1. Clicking "Reply" sets a reply context in state (shows a preview of the message being replied to above the input).
2. The reply creates a message with a `reply_to` field pointing to the parent message ID.
3. In the message feed, replies show a small "Replying to [author]" header with a snippet of the parent message.
4. Clicking the reply header scrolls to the parent message.

### Files to Create/Modify
| File | Action |
|---|---|
| `src/store/useAppStore.ts` | **MODIFY** — Add `replyingTo: Message | null` state, add `reply_to?: string` to Message |
| `src/components/ChatCanvas.tsx` | **MODIFY** — Show reply preview bar above input, send reply_to with message |
| `src/components/MessageRow.tsx` | **MODIFY** — Render reply context header, scroll-to-parent on click |

### Acceptance Criteria
- [ ] Reply button sets reply context
- [ ] Reply preview shows above input with dismiss button
- [ ] Sent reply includes `reply_to` reference
- [ ] Reply messages render with parent context header
- [ ] Clicking reply header scrolls to parent message

---

## TASK 6 — Typing Indicators

### Requirements
1. When the user is typing in a channel, broadcast their presence via Supabase Realtime (presence channel).
2. Show a "X is typing..." indicator below the message feed, above the input.
3. Typing state auto-expires after 3 seconds of inactivity.

### Files to Create/Modify
| File | Action |
|---|---|
| `src/components/ChatCanvas.tsx` | **MODIFY** — Broadcast typing events, display typing indicator |

---

## TASK 7 — Unread Message Counts & Notifications

### Requirements
1. Track the last-read message timestamp per channel in localStorage.
2. Show unread count badges on channel rows in the sidebar.
3. Bold unread channel names.
4. Play a notification sound on new messages (if `soundEnabled` is true and the message is not from the current user).

### Files to Create/Modify
| File | Action |
|---|---|
| `src/store/useAppStore.ts` | **MODIFY** — Add `lastRead: Record<string, string>` state |
| `src/components/ChannelSidebar.tsx` | **MODIFY** — Show unread badges, bold unread channels |
| `src/components/ChatCanvas.tsx` | **MODIFY** — Update lastRead on channel view, play sound on new message |

---

## TASK 8 — Server Invite System

### Requirements
1. Add a "Copy Invite Link" button in the server header or settings.
2. Add a "Join Server" modal accessible from the server rail.
3. User enters an invite code → app looks up the server and joins it.

### Files to Create/Modify
| File | Action |
|---|---|
| `src/components/JoinServerModal.tsx` | **CREATE** — Join-by-invite-code dialog |
| `src/components/ServerRail.tsx` | **MODIFY** — Add "Join Server" button |
| `src/components/ChannelSidebar.tsx` | **MODIFY** — Add invite link copy button in server header |

---

## TASK 9 — Message Editing & Deletion Confirmation

### Requirements
1. Double-clicking a message (own messages only) enters inline edit mode.
2. Pressing Enter saves the edit; Escape cancels.
3. Deleting a message shows a confirmation dialog.
4. Edited messages show an "(edited)" tag next to the timestamp.

### Files to Create/Modify
| File | Action |
|---|---|
| `src/components/MessageRow.tsx` | **MODIFY** — Add inline edit mode, edited tag |
| `src/components/ChatCanvas.tsx` | **MODIFY** — Handle edit submission to Supabase |

---

## TASK 10 — Emoji Picker

### Requirements
1. Replace the quick-reaction chips with a full emoji picker component.
2. Can use a library like `emoji-picker-react` or build a simple categorized grid.
3. Emoji picker opens from the smiley button in the message input area.
4. Selected emoji is inserted at cursor position in the input.

### Files to Create/Modify
| File | Action |
|---|---|
| `src/components/EmojiPicker.tsx` | **CREATE** — Full emoji browser component |
| `src/components/ChatCanvas.tsx` | **MODIFY** — Add emoji picker trigger in input area |
| `src/components/MessageRow.tsx` | **MODIFY** — Replace quick chips with emoji picker for reactions |

---

## Task Dependency Graph

```
TASK 1 (Visual Redesign) ← No dependencies, do this FIRST
    ↓
TASK 2 (Auth) ← Requires redesigned UI to look correct
    ↓
TASK 3 (Voice) ← Can be done independently after Task 1
TASK 4 (Attachments) ← Can be done independently after Task 1
TASK 5 (Replies) ← Can be done independently after Task 1
TASK 6 (Typing) ← Requires Supabase Realtime working
TASK 7 (Unread) ← Can be done independently after Task 1
TASK 8 (Invites) ← Requires Auth (Task 2) for user identity
TASK 9 (Edit/Delete) ← Can be done independently after Task 1
TASK 10 (Emoji) ← Can be done independently after Task 1
```

### Recommended Execution Order
1. **Task 1** — Visual Identity (must be first)
2. **Task 2** — Auth
3. **Task 5** — Replies (small scope, high UX impact)
4. **Task 7** — Unread counts (small scope, high UX impact)
5. **Task 4** — File uploads
6. **Task 3** — Voice channels
7. **Task 6** — Typing indicators
8. **Task 8** — Server invites
9. **Task 9** — Message editing
10. **Task 10** — Emoji picker
