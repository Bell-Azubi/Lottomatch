import { useState } from 'preact/hooks';
import { validEventName, type AdminError } from '../../../application/match-admin';
import type { MatchRecord } from '../../../application/records';
import { commonText } from '../../../i18n/catalogues';
import { formatCalendarDate } from '../../../i18n/format';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { TextField } from '../../design-system/Field';
import { showToast } from '../../design-system/toast-store';
import { settingsText } from './messages';
import { Section } from './Section';
import styles from './Settings.module.css';

type NameDialog =
  | { readonly mode: 'create' }
  | { readonly mode: 'duplicate'; readonly source: MatchRecord }
  | { readonly mode: 'practice' };

function EventRow({
  match,
  active,
  disabled,
  onSwitch,
  onDuplicate,
  onArchive,
}: {
  readonly match: MatchRecord;
  readonly active: boolean;
  readonly disabled: boolean;
  readonly onSwitch: () => void;
  readonly onDuplicate: () => void;
  readonly onArchive: () => void;
}) {
  const m = t(settingsText);
  const nameId = `event-${match.id}-name`;
  const { settings } = match;
  return (
    <li class={`${styles.item} ${active ? styles.itemActive : ''}`}>
      <div class={styles.itemMain}>
        <span id={nameId} class={styles.itemName}>
          {settings.name}
        </span>
        <span class={styles.itemMeta}>
          <span class="tabular">
            {settings.date === '' ? m.events.noDate : formatCalendarDate(settings.date)}
          </span>
          {active && <span class={`${styles.badge} ${styles.badgeActive}`}>{m.events.active}</span>}
          {match.kind === 'PRACTICE' && (
            <span class={`${styles.badge} ${styles.badgePractice}`}>{m.events.practice}</span>
          )}
          {match.archived && <span class={styles.badge}>{m.events.archived}</span>}
        </span>
      </div>
      <div class={styles.actions}>
        {!active && (
          <Button disabled={disabled} aria-describedby={nameId} onClick={onSwitch}>
            {m.events.switch}
          </Button>
        )}
        <Button disabled={disabled} aria-describedby={nameId} onClick={onDuplicate}>
          {m.events.duplicate}
        </Button>
        {!active && (
          <Button disabled={disabled} aria-describedby={nameId} onClick={onArchive}>
            {match.archived ? m.events.restore : m.events.archive}
          </Button>
        )}
      </div>
    </li>
  );
}

/** Anlässe: list, create, duplicate as template, switch, archive, practice mode (FR-9). */
export function EventsSection({ canEdit }: { readonly canEdit: boolean }) {
  const m = t(settingsText);
  const c = t(commonText);
  const { app, admin, host } = useHostServices();
  const [dialog, setDialog] = useState<NameDialog | undefined>(undefined);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [pendingSwitch, setPendingSwitch] = useState<MatchRecord | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const session = app.session.value;
  const activeId = session?.matchId;
  const running = session?.game.value.phase === 'ROUND_RUNNING';
  const fail = (error: AdminError) => {
    showToast(m.events.errors[error], { tone: 'error' });
  };
  const clearLiveState = () => {
    host.overlays.hideAll();
    host.reveal.clear();
  };
  const switchTo = async (match: MatchRecord) => {
    setPendingSwitch(undefined);
    setBusy(true);
    const result = await admin.switchTo(match.id);
    setBusy(false);
    if (!result.ok) {
      fail(result.error);
      return;
    }
    clearLiveState();
    showToast(m.events.switched(match.settings.name), { tone: 'success' });
  };
  const openDialog = (next: NameDialog) => {
    const activeName = session?.match.value.settings.name ?? m.events.defaultName;
    setName(
      next.mode === 'create'
        ? m.events.defaultName
        : next.mode === 'duplicate'
          ? m.events.copyName(next.source.settings.name)
          : m.events.practiceName(activeName),
    );
    setNameError(undefined);
    setDialog(next);
  };
  const submitName = async (current: NameDialog) => {
    if (validEventName(name) === undefined) {
      setNameError(m.events.errors.INVALID_NAME);
      return;
    }
    setBusy(true);
    const result =
      current.mode === 'create'
        ? await admin.create(name)
        : current.mode === 'duplicate'
          ? await admin.duplicate(current.source.id, name)
          : await admin.startPractice(name);
    setBusy(false);
    if (!result.ok) {
      fail(result.error);
      return;
    }
    if (current.mode !== 'duplicate') clearLiveState();
    showToast(m.events.created(result.value.settings.name), { tone: 'success' });
    setDialog(undefined);
  };
  const setArchived = async (match: MatchRecord) => {
    setBusy(true);
    const result = await admin.setArchived(match.id, !match.archived);
    setBusy(false);
    if (!result.ok) {
      fail(result.error);
      return;
    }
    const message = match.archived ? m.events.restoredToast : m.events.archivedToast;
    showToast(message(match.settings.name), { tone: 'success' });
  };
  const disabled = !canEdit || busy;
  return (
    <Section id="events" title={m.sections.events} intro={m.events.intro}>
      <div class={styles.actions}>
        <Button
          variant="primary"
          disabled={disabled}
          onClick={() => {
            openDialog({ mode: 'create' });
          }}
        >
          {m.events.create}
        </Button>
        <Button
          disabled={disabled || session === undefined}
          onClick={() => {
            openDialog({ mode: 'practice' });
          }}
        >
          {m.events.practiceStart}
        </Button>
      </div>
      <ul class={styles.list} aria-label={m.events.listLabel}>
        {app.matches.value.map((match) => (
          <EventRow
            key={match.id}
            match={match}
            active={match.id === activeId}
            disabled={disabled}
            onSwitch={() => {
              if (running) setPendingSwitch(match);
              else void switchTo(match);
            }}
            onDuplicate={() => {
              openDialog({ mode: 'duplicate', source: match });
            }}
            onArchive={() => {
              void setArchived(match);
            }}
          />
        ))}
      </ul>
      {dialog !== undefined && (
        <Dialog
          open
          title={
            dialog.mode === 'create'
              ? m.events.createTitle
              : dialog.mode === 'duplicate'
                ? m.events.duplicateTitle
                : m.events.practiceStart
          }
          onClose={() => {
            setDialog(undefined);
          }}
          actions={
            <>
              <Button
                onClick={() => {
                  setDialog(undefined);
                }}
              >
                {c.actions.cancel}
              </Button>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => {
                  void submitName(dialog);
                }}
              >
                {dialog.mode === 'practice' ? m.events.practiceStart : c.actions.confirm}
              </Button>
            </>
          }
        >
          {dialog.mode === 'duplicate' && <p>{m.events.duplicateHint}</p>}
          {dialog.mode === 'practice' && <p>{m.events.practiceBody}</p>}
          <TextField
            label={m.events.nameLabel}
            value={name}
            onValue={setName}
            maxLength={80}
            error={nameError}
          />
        </Dialog>
      )}
      <Dialog
        open={pendingSwitch !== undefined}
        title={m.events.switchRunningTitle}
        onClose={() => {
          setPendingSwitch(undefined);
        }}
        actions={
          <>
            <Button
              onClick={() => {
                setPendingSwitch(undefined);
              }}
            >
              {c.actions.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pendingSwitch !== undefined) void switchTo(pendingSwitch);
              }}
            >
              {m.events.switchConfirm}
            </Button>
          </>
        }
      >
        <p>{m.events.switchRunningBody}</p>
      </Dialog>
    </Section>
  );
}
