import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cx } from '../lib/cx';
import { PRESET_THEMES } from '../theme/presets';
import { useAppStore } from '../store/useAppStore';
import { Avatar, Button, FieldLabel, Input } from '../ui/primitives';

const COLORS = ['#8b8b95', '#c89b5c', '#7fb79b', '#9b7bf7', '#d2603f', '#5b8dd6', '#c26b9c', '#4fbf88'];

/**
 * First run. Two decisions only — who you are, and what it looks like — because
 * the theme is the product's thesis and it should be the first thing you touch.
 */
export function Onboarding() {
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const seedIfEmpty = useAppStore((s) => s.seedIfEmpty);
  const themeId = useAppStore((s) => s.themeId);
  const setThemeId = useAppStore((s) => s.setThemeId);

  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[2]);

  function start() {
    completeOnboarding(name || 'You', color);
    seedIfEmpty();
  }

  return (
    <div className="flex h-full items-center justify-center bg-canvas p-6">
      <div className="anim-rise w-full max-w-[520px]">
        <div className="mb-8">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent text-[15px] font-bold text-accent-ink">
              B
            </span>
            <span className="text-[12px] font-semibold tracking-[0.08em] text-ink-dim">
              Beacon
            </span>
          </div>
          <h1 className="font-display text-[46px] leading-[1.02] tracking-[-0.015em] text-ink">
            Chat that looks
            <br />
            like <em className="italic">you</em> chose it.
          </h1>
          <p className="mt-3 max-w-[42ch] text-[14px] leading-relaxed text-ink-mute">
            Voice, files and messages, free and local by default. Every colour in the interface is
            yours to change — start with a preset, then make your own.
          </p>
        </div>

        <div className="sheet p-5">
          <FieldLabel>What should people call you?</FieldLabel>
          <div className="flex items-center gap-3">
            <Avatar name={name || 'You'} color={color} size="md" />
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && start()}
              placeholder="Your name"
              maxLength={32}
            />
          </div>

          <div className="mt-4">
            <FieldLabel>Your colour</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setColor(value)}
                  aria-label={`Use ${value}`}
                  className={cx(
                    'h-8 w-8 rounded-[9px] transition-transform',
                    color === value
                      ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface'
                      : 'hover:scale-105',
                  )}
                  style={{ backgroundColor: value }}
                />
              ))}
            </div>
          </div>

          <div className="mt-5">
            <FieldLabel>Pick a starting theme</FieldLabel>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setThemeId(theme.id)}
                  title={theme.blurb}
                  className={cx(
                    'overflow-hidden rounded-md border transition-colors',
                    theme.id === themeId ? 'border-accent' : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className="flex h-8" style={{ backgroundColor: theme.tokens.bg }}>
                    <span className="w-1/4" style={{ backgroundColor: theme.tokens.panel }} />
                    <span className="flex-1" style={{ backgroundColor: theme.tokens.surface }} />
                    <span className="my-2 mr-2 w-2 rounded-full" style={{ backgroundColor: theme.tokens.accent }} />
                  </span>
                  <span className="block truncate px-1.5 py-1 text-[10.5px] font-medium text-ink-dim">
                    {theme.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Button variant="accent" size="lg" block className="mt-5" onClick={start}>
            Start chatting <ArrowRight size={15} />
          </Button>
          <p className="mt-2.5 text-center text-[11.5px] text-ink-mute">
            No account, no email. Everything stays on this device.
          </p>
        </div>
      </div>
    </div>
  );
}
