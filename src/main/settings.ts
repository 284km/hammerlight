import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface Settings {
  overlayPort: number;
}

export const DEFAULT_SETTINGS: Settings = { overlayPort: 17321 };

// Ports below 1024 need admin rights on some systems; keep to the user range.
export function isValidPort(port: unknown): port is number {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1024 && port <= 65535;
}

// A missing or damaged file falls back to the defaults rather than stopping the app.
export async function loadSettings(file: string): Promise<Settings> {
  let parsed: Partial<Settings> = {};
  try {
    parsed = JSON.parse(await readFile(file, 'utf8')) as Partial<Settings>;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    overlayPort: isValidPort(parsed.overlayPort) ? parsed.overlayPort : DEFAULT_SETTINGS.overlayPort,
  };
}

export async function saveSettings(file: string, settings: Settings): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(settings, null, 2) + '\n');
}
