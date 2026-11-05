import { downloadBackup } from '../../../application/backup-export';
import { nextRoundPreview } from '../../../application/selectors';
import { PRIZE_SLOTS } from '../../../domain/types';
import { roundOf } from '../../../domain/state';
import { commonText, liveText } from '../../../i18n/catalogues';
import { conditionLabel, prizeTitle } from '../../../i18n/labels';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { href } from '../../app/router';
import { Button } from '../../design-system/Button';
import styles from './RoundSummary.module.css';

export interface RoundSummaryProps {
  readonly onStartRound: () => void;
  readonly onComplete: () => void;
  readonly readOnly: boolean;
}

/** Between rounds: round summary and next-round preview; after the last round: backup prompt. */
export function RoundSummary({ onStartRound, onComplete, readOnly }: RoundSummaryProps) {
  const m = t(liveText);
  const c = t(commonText);
  const { app, host } = useHostServices();
  const session = app.session.value;
  if (session === undefined) return null;
  const game = session.game.value;
  const { settings } = session.match.value;
  const preview = nextRoundPreview(game, session.catalogue.value, settings);
  const last = game.currentRound === undefined ? undefined : roundOf(game, game.currentRound);
  const backup = (
    <Button
      onClick={() => {
        void downloadBackup(app);
      }}
    >
      {m.summary.exportBackup}
    </Button>
  );
  if (game.phase === 'COMPLETED') {
    return (
      <section class={styles.summary}>
        <h2>{m.status.completed}</h2>
        <p>{m.summary.backupPrompt}</p>
        <div class={styles.actions}>
          {backup}
          <a href={href('results')}>{c.nav.results}</a>
        </div>
      </section>
    );
  }
  return (
    <section class={styles.summary}>
      {last !== undefined && last.status !== 'UPCOMING' && (
        <>
          <h2>{m.summary.roundDone(last.round)}</h2>
          <ul class={styles.winners}>
            {PRIZE_SLOTS.map((slot) => {
              const outcome = last.prizes[slot];
              const cards = outcome.award?.winners.map((w) => w.cardNo ?? '–').join(', ');
              return (
                <li key={slot}>
                  <strong>{c.prizeSlot(slot)}:</strong>{' '}
                  {outcome.status === 'AWARDED'
                    ? cards
                    : c.progress[outcome.status === 'SKIPPED' ? 'SKIPPED' : 'UPCOMING']}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {preview === undefined ? (
        <>
          <h2>{m.summary.allPlayed}</h2>
          <p>{m.summary.backupPrompt}</p>
          <div class={styles.actions}>
            {backup}
            <Button variant="primary" disabled={readOnly} onClick={onComplete}>
              {m.overrides.complete}
            </Button>
          </div>
        </>
      ) : (
        <>
          <h3>{m.summary.nextRound(preview.round)}</h3>
          <ol class={styles.preview}>
            {preview.prizes.map(({ slot, prize, condition }) => (
              <li key={slot}>
                {prizeTitle(prize?.title, slot, c)}
                <span class={styles.condition}> · {conditionLabel(condition, c)}</span>
                {prize === undefined && <span class={styles.gap}> ({m.summary.gap})</span>}
              </li>
            ))}
          </ol>
          <div class={styles.actions}>
            <Button variant="primary" size="lg" disabled={readOnly} onClick={onStartRound}>
              {m.bar.startRoundN(preview.round)}
            </Button>
            {game.phase === 'BETWEEN_ROUNDS' && (
              <Button
                disabled={readOnly}
                onClick={() => {
                  host.overlays.showRoundEnd();
                }}
              >
                {m.summary.showRoundEnd}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
