import type {
  AnimationSpeed,
  LocaleChoice,
  Preferences,
  ThemeChoice,
} from '../../../application/records';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { SelectField, Toggle } from '../../design-system/Field';
import { settingsText } from './messages';
import { Section } from './Section';
import styles from './Settings.module.css';

const LOCALES: readonly LocaleChoice[] = ['de-CH', 'en'];
const THEMES: readonly ThemeChoice[] = ['SYSTEM', 'DARK', 'LIGHT'];
const ANIMATIONS: readonly AnimationSpeed[] = ['OFF', 'SHORT', 'NORMAL', 'THRILL'];

/** Darstellung: device-level presentation preferences, applied immediately (FR-9). */
export function PresentationSection({ canEdit }: { readonly canEdit: boolean }) {
  const m = t(settingsText);
  const { app } = useHostServices();
  const prefs = app.prefs.value;
  const voiceSupported = app.platform.announcer.supported;
  const disabled = !canEdit;
  const set = (patch: Partial<Preferences>) => {
    app.setPreferences(patch);
  };
  const p = m.presentation;
  return (
    <Section id="presentation" title={m.sections.presentation} intro={p.intro}>
      <div class={styles.grid}>
        <SelectField
          label={p.locale}
          value={prefs.locale}
          options={LOCALES.map((value) => ({ value, label: p.locales[value] }))}
          onValue={(locale) => {
            set({ locale });
          }}
          disabled={disabled}
        />
        <SelectField
          label={p.hostTheme}
          value={prefs.hostTheme}
          options={THEMES.map((value) => ({ value, label: p.themes[value] }))}
          onValue={(hostTheme) => {
            set({ hostTheme });
          }}
          disabled={disabled}
        />
        <SelectField
          label={p.displayTheme}
          value={prefs.displayTheme}
          options={THEMES.map((value) => ({ value, label: p.themes[value] }))}
          onValue={(displayTheme) => {
            set({ displayTheme });
          }}
          disabled={disabled}
        />
        <SelectField
          label={p.animation}
          value={prefs.animation}
          options={ANIMATIONS.map((value) => ({ value, label: p.animations[value] }))}
          onValue={(animation) => {
            set({ animation });
          }}
          disabled={disabled}
        />
      </div>
      <Toggle
        label={p.performance}
        hint={p.performanceHint}
        checked={prefs.performanceMode}
        onChange={(performanceMode) => {
          set({ performanceMode });
        }}
        disabled={disabled}
      />
      <Toggle
        label={p.sound}
        hint={p.soundHint}
        checked={prefs.sound}
        onChange={(sound) => {
          set({ sound });
        }}
        disabled={disabled}
      />
      {voiceSupported ? (
        <>
          <Toggle
            label={p.voice}
            hint={p.voiceHint}
            checked={prefs.voice}
            onChange={(voice) => {
              set({ voice });
            }}
            disabled={disabled}
          />
          <Toggle
            label={p.voiceDigits}
            hint={p.voiceDigitsHint}
            checked={prefs.voiceDigits}
            onChange={(voiceDigits) => {
              set({ voiceDigits });
            }}
            disabled={disabled || !prefs.voice}
          />
        </>
      ) : (
        <p class={styles.hint}>{p.voiceUnsupported}</p>
      )}
    </Section>
  );
}
