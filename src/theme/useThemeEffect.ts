import { useEffect } from 'react';
import { useAppStore, activeTheme } from '../store/useAppStore';
import { applyTheme } from './apply';

/**
 * Repaints the document whenever the active theme or appearance changes. Waits
 * for persist rehydration so the saved theme wins over the Obsidian default
 * baked into :root — otherwise a custom theme would flash grey on every load.
 */
export function useThemeEffect(): void {
  const hydrated = useAppStore((s) => s.hydrated);
  const themeId = useAppStore((s) => s.themeId);
  const customThemes = useAppStore((s) => s.customThemes);
  const appearance = useAppStore((s) => s.appearance);

  useEffect(() => {
    if (!hydrated) return;
    const theme = activeTheme(useAppStore.getState());
    applyTheme(theme, appearance);
  }, [hydrated, themeId, customThemes, appearance]);
}
