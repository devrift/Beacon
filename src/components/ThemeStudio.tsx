import { useShallow } from 'zustand/react/shallow';
import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react';
import { cx } from '../lib/cx';
import { contrastRatio, gradeContrast, normalizeHex } from '../theme/color';
import {
  adjustThemeContrast,
  applyTheme,
  decodeTheme,
  deriveThemeFromAccent,
  encodeTheme,
} from '../theme/apply';
import { PRESET_THEMES } from '../theme/presets';
import { TOKEN_FIELDS, TOKEN_GROUPS, type Theme, type ThemeMode } from '../theme/types';
import { activeTheme, allThemes, useAppStore } from '../store/useAppStore';
import { Button, FieldLabel, Input, Segmented } from '../ui/primitives';
import { ConfirmDialog, Modal } from '../ui/overlays';

const SEED_COLORS = [
  '#e4e4e9',
  '#c89b5c',
  '#7fb79b',
  '#9b7bf7',
  '#d2603f',
  '#5b8dd6',
  '#c26b9c',
  '#4fbf88',
];

type Tab = 'gallery' | 'edit' | 'share';

export function ThemeStudio() {
  const open = useAppStore((s) => s.dialog === 'themeStudio');
  const closeDialog = useAppStore((s) => s.closeDialog);
  const themes = useAppStore(useShallow(allThemes));
  const themeId = useAppStore((s) => s.themeId);
  const setThemeId = useAppStore((s) => s.setThemeId);
  const saveCustomTheme = useAppStore((s) => s.saveCustomTheme);
  const deleteCustomTheme = useAppStore((s) => s.deleteCustomTheme);
  const appearance = useAppStore((s) => s.appearance);
  const toast = useAppStore((s) => s.toast);

  const [tab, setTab] = useState<Tab>('gallery');
  const [draft, setDraft] = useState<Theme | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Editing previews live on the real document, so you judge it in situ rather
  // than through a swatch. Closing without saving puts the old theme back.
  useEffect(() => {
    if (!open) return;
    if (draft) applyTheme(draft, appearance);
    else applyTheme(activeTheme(useAppStore.getState()), appearance);
  }, [draft, open, appearance]);

  useEffect(() => {
    if (!open) {
      setDraft(null);
      setCode('');
      setCodeError('');
    }
  }, [open]);

  function startFromCurrent() {
    const base = activeTheme(useAppStore.getState());
    setDraft({
      ...base,
      id: `custom-${Date.now().toString(36)}`,
      name: `${base.name} remix`,
      builtIn: false,
      tokens: { ...base.tokens },
    });
    setTab('edit');
  }

  function commit() {
    if (!draft) return;
    saveCustomTheme(draft);
    toast('ok', `${draft.name} saved`, 'It lives in your themes now.');
    setDraft(null);
    setTab('gallery');
  }

  function discard() {
    setDraft(null);
    applyTheme(activeTheme(useAppStore.getState()), appearance);
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        discard();
        closeDialog();
      }}
      title="Theme studio"
      description="Eight themes ship in the box. The ninth is yours."
      width="xl"
      footer={
        draft ? (
          <>
            <Button variant="ghost" onClick={discard}>
              Discard
            </Button>
            <Button variant="accent" onClick={commit}>
              Save theme
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={closeDialog}>
              Done
            </Button>
            <Button variant="accent" onClick={startFromCurrent}>
              <Sparkles size={14} /> Remix this theme
            </Button>
          </>
        )
      }
    >
      <div className="mb-4">
        <Segmented
          label="Studio section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'gallery', label: 'Themes' },
            { value: 'edit', label: 'Editor' },
            { value: 'share', label: 'Share' },
          ]}
        />
      </div>

      {tab === 'gallery' && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              active={theme.id === themeId && !draft}
              onPick={() => {
                setDraft(null);
                setThemeId(theme.id);
              }}
              onDelete={theme.builtIn ? undefined : () => setConfirmDelete(theme.id)}
            />
          ))}
        </div>
      )}

      {tab === 'edit' && (
        <Editor
          draft={draft}
          setDraft={setDraft}
          onSeed={(hex, mode) => setDraft(deriveThemeFromAccent(hex, mode, 'Custom'))}
          onStart={startFromCurrent}
        />
      )}

      {tab === 'share' && (
        <div className="flex flex-col gap-5">
          <div>
            <FieldLabel>Export the active theme</FieldLabel>
            <p className="mb-2 text-[12.5px] leading-relaxed text-ink-mute">
              Copy this code and send it to anyone. No account, no upload — the whole theme
              travels in the string.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={encodeTheme(draft ?? activeTheme(useAppStore.getState()))}
                className="font-mono text-[11.5px]"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                onClick={() => {
                  void navigator.clipboard.writeText(
                    encodeTheme(draft ?? activeTheme(useAppStore.getState())),
                  );
                  toast('ok', 'Theme code copied');
                }}
              >
                <Copy size={14} /> Copy
              </Button>
            </div>
          </div>

          <div className="h-px bg-line" />

          <div>
            <FieldLabel>Import a theme</FieldLabel>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeError('');
                }}
                placeholder="beacon1:…"
                className="font-mono text-[11.5px]"
                invalid={Boolean(codeError)}
              />
              <Button
                variant="accent"
                onClick={() => {
                  const result = decodeTheme(code);
                  if (!result.ok) {
                    setCodeError(result.error);
                    return;
                  }
                  saveCustomTheme(result.theme);
                  toast('ok', `${result.theme.name} imported`);
                  setCode('');
                  setTab('gallery');
                }}
              >
                <Upload size={14} /> Import
              </Button>
            </div>
            {codeError && <p className="mt-2 text-[12px] text-danger">{codeError}</p>}
          </div>

          <div>
            <Button
              variant="outline"
              onClick={() => {
                const theme = draft ?? activeTheme(useAppStore.getState());
                const blob = new Blob([JSON.stringify(theme, null, 2)], {
                  type: 'application/json',
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${theme.name.toLowerCase().replace(/\s+/g, '-')}.beacon-theme.json`;
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={14} /> Download as JSON
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) deleteCustomTheme(confirmDelete);
        }}
        title="Delete this theme?"
        body="It is removed from your themes. Built-in themes are never touched."
      />
    </Modal>
  );
}

function ThemeCard({
  theme,
  active,
  onPick,
  onDelete,
}: {
  theme: Theme;
  active: boolean;
  onPick: () => void;
  onDelete?: () => void;
}) {
  const t = theme.tokens;
  return (
    <div
      className={cx(
        'group relative overflow-hidden rounded-md border transition-colors',
        active ? 'border-accent' : 'border-line hover:border-line-strong',
      )}
    >
      <button type="button" onClick={onPick} className="block w-full text-left">
        {/* A miniature of the app, built from the theme's own tokens. */}
        <div className="flex h-[76px]" style={{ backgroundColor: t.bg }}>
          <div className="w-3.5" style={{ backgroundColor: t.bg }}>
            <div className="mx-auto mt-2 h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: t.accent }} />
          </div>
          <div className="w-[38px] px-1.5 py-2" style={{ backgroundColor: t.panel }}>
            <div className="mb-1 h-1.5 w-full rounded-full" style={{ backgroundColor: t.active }} />
            <div className="mb-1 h-1.5 w-3/4 rounded-full" style={{ backgroundColor: t.border }} />
            <div className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: t.border }} />
          </div>
          <div className="flex-1 px-2 py-2" style={{ backgroundColor: t.surface }}>
            <div className="mb-1.5 h-1.5 w-1/3 rounded-full" style={{ backgroundColor: t.text }} />
            <div className="mb-1 h-1.5 w-full rounded-full" style={{ backgroundColor: t.textDim, opacity: 0.5 }} />
            <div className="mb-2.5 h-1.5 w-4/5 rounded-full" style={{ backgroundColor: t.textMute, opacity: 0.4 }} />
            <div className="h-3 w-full rounded-[3px] border" style={{ borderColor: t.border, backgroundColor: t.raised }} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-2">
          <span className="truncate text-[12.5px] font-medium text-ink">{theme.name}</span>
          {active && <Check size={13} className="shrink-0 text-accent" />}
          <span className="ml-auto shrink-0 text-[10.5px] text-ink-mute">
            {theme.builtIn ? theme.mode : 'yours'}
          </span>
        </div>
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${theme.name}`}
          className="absolute top-1.5 right-1.5 hidden rounded-sm bg-canvas/80 p-1 text-ink-mute backdrop-blur group-hover:block hover:text-danger"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

function Editor({
  draft,
  setDraft,
  onSeed,
  onStart,
}: {
  draft: Theme | null;
  setDraft: (theme: Theme) => void;
  onSeed: (hex: string, mode: ThemeMode) => void;
  onStart: () => void;
}) {
  const [seed, setSeed] = useState('#7fb79b');
  const [mode, setMode] = useState<ThemeMode>('dark');

  const readability = useMemo(() => {
    if (!draft) return null;
    const ratio = contrastRatio(draft.tokens.text, draft.tokens.bg);
    return { ratio, grade: gradeContrast(ratio) };
  }, [draft]);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-md border border-line bg-canvas p-3.5">
        <FieldLabel>Start from one colour</FieldLabel>
        <p className="mb-2.5 text-[12.5px] leading-relaxed text-ink-mute">
          Pick an accent and the studio derives every surface, border and text tone around it —
          the greys get pulled a few degrees toward your hue so the palette reads as one material.
        </p>
        <div className="mb-2.5 flex flex-wrap gap-2">
          {SEED_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => {
                setSeed(hex);
                onSeed(hex, mode);
              }}
              aria-label={`Derive from ${hex}`}
              className="h-7 w-7 rounded-[8px] transition-transform hover:scale-110"
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            aria-label="Custom accent colour"
            className="h-9 w-12 cursor-pointer rounded-md border border-line bg-transparent"
          />
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="w-[110px] font-mono text-[12px]"
          />
          <Segmented
            label="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
          />
          <Button variant="accent" onClick={() => onSeed(seed, mode)}>
            <Sparkles size={14} /> Generate
          </Button>
        </div>
      </div>

      {!draft ? (
        <div className="rounded-md border border-dashed border-line-strong p-6 text-center">
          <p className="text-[13px] text-ink-dim">Generate a theme above, or remix the one you are using.</p>
          <Button className="mt-3" onClick={onStart}>
            Remix the active theme
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <FieldLabel>Theme name</FieldLabel>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                maxLength={40}
              />
            </div>
            <Button onClick={() => setDraft(adjustThemeContrast(draft, 0.04))}>Lighter</Button>
            <Button onClick={() => setDraft(adjustThemeContrast(draft, -0.04))}>Darker</Button>
            <Button
              variant="ghost"
              onClick={() => {
                const base = PRESET_THEMES.find((p) => p.id === draft.id.replace('custom-', ''));
                setDraft({ ...draft, tokens: { ...(base ?? PRESET_THEMES[0]).tokens } });
              }}
            >
              <RotateCcw size={14} /> Reset colours
            </Button>
          </div>

          {readability && (
            <div
              className={cx(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-[12.5px]',
                readability.grade === 'Fail'
                  ? 'border-danger/40 bg-danger/8 text-danger'
                  : 'border-line bg-canvas text-ink-mute',
              )}
            >
              <span className="font-medium">Body text contrast {readability.ratio.toFixed(2)}:1</span>
              <span className="ml-auto font-mono">{readability.grade}</span>
            </div>
          )}

          {TOKEN_GROUPS.map((group) => (
            <div key={group.id}>
              <FieldLabel>{group.label}</FieldLabel>
              <p className="mb-2 text-[12px] text-ink-mute">{group.blurb}</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {TOKEN_FIELDS.filter((f) => f.group === group.id).map((field) => (
                  <div key={field.key} className="flex items-center gap-2 rounded-sm px-1 py-1 hover:bg-hover">
                    <input
                      type="color"
                      value={normalizeHex(draft.tokens[field.key]) ?? '#000000'}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          tokens: { ...draft.tokens, [field.key]: e.target.value },
                        })
                      }
                      aria-label={field.label}
                      className="h-7 w-9 shrink-0 cursor-pointer rounded-[6px] border border-line bg-transparent"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium text-ink">{field.label}</div>
                      <div className="truncate text-[11px] text-ink-mute">{field.help}</div>
                    </div>
                    <input
                      value={draft.tokens[field.key]}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          tokens: { ...draft.tokens, [field.key]: e.target.value },
                        })
                      }
                      aria-label={`${field.label} hex`}
                      className="w-[74px] shrink-0 rounded-sm border border-line bg-canvas px-1.5 py-1 font-mono text-[11px] text-ink-dim outline-none focus:border-accent"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
