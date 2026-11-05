import { describe, expect, it } from 'vitest';
import type { ImportError } from '../../../application/backup-import';
import { settingsData as de } from '../../../i18n/de-CH/settings-data';
import { settingsData as en } from '../../../i18n/en/settings-data';
import { importErrorText } from './ImportPanel';

const errors: readonly ImportError[] = [
  { code: 'NOT_JSON' },
  { code: 'FOREIGN' },
  { code: 'TOO_NEW', version: 4 },
  { code: 'UNSUPPORTED', version: 0 },
  { code: 'CHECKSUM_MISMATCH' },
  { code: 'INVALID', path: 'match.settings' },
  { code: 'INVALID_SETTINGS' },
  { code: 'INVALID_PRIZES', count: 1 },
  { code: 'INVALID_PRIZES', count: 3 },
  { code: 'LOG_CORRUPT', seq: 12 },
];

describe('importErrorText', () => {
  it('has a specific de-CH message for every import failure', () => {
    expect(errors.map((error) => importErrorText(error, de))).toEqual([
      'Die Datei ist kein gültiges JSON.',
      'Die Datei stammt nicht aus Lottomatch Live.',
      'Die Datei stammt aus einer neueren Version (Schema 4). Bitte die App aktualisieren.',
      'Schemaversion 0 wird nicht unterstützt.',
      'Die Prüfsumme stimmt nicht: Die Datei wurde verändert oder ist beschädigt.',
      'Die Datei ist unvollständig oder fehlerhaft (bei «match.settings»).',
      'Die Einstellungen in der Datei sind ungültig.',
      '1 Preis in der Datei ist ungültig.',
      '3 Preise in der Datei sind ungültig.',
      'Das Spielprotokoll ist beschädigt (Eintrag 12).',
    ]);
  });

  it('is translated for English', () => {
    const texts = errors.map((error) => importErrorText(error, en));
    expect(texts[2]).toBe('The file comes from a newer version (schema 4). Please update the app.');
    expect(new Set(texts).size).toBe(texts.length);
  });
});
