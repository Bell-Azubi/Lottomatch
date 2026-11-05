import { useEffect, useState } from 'preact/hooks';
import { applySettings, normaliseSettings } from '../../../application/settings-editor';
import {
  checkSettingsChange,
  highestStartedRound,
  type SettingsField,
} from '../../../domain/settings';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/Field';
import { showToast } from '../../design-system/toast-store';
import {
  draftFromSettings,
  messagesByField,
  settingsFromDraft,
  type EventDraft,
} from './event-draft';
import { GameFields } from './GameFields';
import { settingsText } from './messages';
import { RuleFields } from './RuleFields';
import { Section } from './Section';
import styles from './Settings.module.css';

/** Anlass: settings of the active event, validated against the running game (FR-9, I6). */
export function EventForm({ canEdit }: { readonly canEdit: boolean }) {
  const m = t(settingsText);
  const { app } = useHostServices();
  const session = app.session.value;
  const match = session?.match.value;
  const [draft, setDraft] = useState<EventDraft | undefined>(
    match === undefined ? undefined : draftFromSettings(match.settings),
  );
  const [errors, setErrors] = useState<Partial<Record<SettingsField, string>>>({});
  const matchId = match?.id;
  const version = match?.settingsVersion;
  useEffect(() => {
    const current = app.session.value?.match.value;
    setDraft(current === undefined ? undefined : draftFromSettings(current.settings));
    setErrors({});
  }, [app, matchId, version]);
  if (session === undefined || match === undefined || draft === undefined) return null;
  const game = session.game.value;
  const locked = game.phase === 'ROUND_RUNNING';
  const minRounds = Math.max(1, highestStartedRound(game));
  const disabled = !canEdit;
  const update = (patch: Partial<EventDraft>) => {
    setDraft({ ...draft, ...patch });
  };
  const save = () => {
    const conversion = settingsFromDraft(draft, match.settings);
    if (conversion.issues.length > 0) {
      const domain = checkSettingsChange(
        game,
        match.settings,
        normaliseSettings(conversion.settings),
      );
      setErrors(messagesByField([...conversion.issues, ...domain], m, minRounds));
      showToast(m.form.fixErrors, { tone: 'error' });
      return;
    }
    const result = applySettings(app, conversion.settings);
    if (!result.ok) {
      if (result.error === 'READ_ONLY') {
        showToast(m.readOnly, { tone: 'error' });
        return;
      }
      setErrors(messagesByField(result.error, m, minRounds));
      showToast(m.form.fixErrors, { tone: 'error' });
      return;
    }
    setErrors({});
    showToast(result.value.changes === 0 ? m.form.unchanged : m.form.saved, { tone: 'success' });
  };
  return (
    <Section id="event" title={m.sections.event} intro={m.form.intro}>
      <form
        class={styles.section}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div class={styles.grid}>
          <TextField
            label={m.form.name}
            value={draft.name}
            onValue={(name) => {
              update({ name });
            }}
            maxLength={80}
            required
            disabled={disabled}
            error={errors.name}
          />
          <TextField
            label={m.form.date}
            type="date"
            value={draft.date}
            onValue={(date) => {
              update({ date });
            }}
            disabled={disabled}
            error={errors.date}
          />
          <TextField
            label={m.form.venue}
            value={draft.venue}
            onValue={(venue) => {
              update({ venue });
            }}
            maxLength={80}
            disabled={disabled}
            error={errors.venue}
          />
        </div>
        <GameFields
          draft={draft}
          update={update}
          errors={errors}
          disabled={disabled}
          locked={locked}
          minRounds={minRounds}
        />
        <RuleFields
          draft={draft}
          update={update}
          errors={errors}
          disabled={disabled}
          locked={locked}
          minRounds={minRounds}
        />
        <div class={styles.actions}>
          <Button type="submit" variant="primary" disabled={disabled}>
            {m.form.save}
          </Button>
        </div>
      </form>
    </Section>
  );
}
