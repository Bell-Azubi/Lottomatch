import { useEffect, useRef } from 'preact/hooks';
import type { ImageStore } from '../../../application/ports';
import type { PrizeEditor } from '../../../application/prize-editor';
import { isAwarded, slotsForRound } from '../../../application/selectors';
import { prizeAt, type Catalogue } from '../../../domain/catalogue';
import { templateCondition, type ConditionTemplate } from '../../../domain/settings';
import { roundOf, type GameState } from '../../../domain/state';
import { commonText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { Button } from '../../design-system/Button';
import { Panel } from '../../design-system/Surface';
import { PrizeForm } from './PrizeForm';
import styles from './PrizesPage.module.css';
import { prizesText } from './text';

export interface RoundEditorProps {
  readonly round: number;
  readonly catalogue: Catalogue;
  readonly template: ConditionTemplate;
  readonly game: GameState;
  readonly editor: PrizeEditor;
  readonly images: ImageStore;
  readonly readOnly: boolean;
  readonly onClose: () => void;
}

/**
 * The prizes of one round, with a Superlotto only where the list has one; edits to running and
 * upcoming rounds show live on the display.
 */
export function RoundEditor({
  round,
  catalogue,
  template,
  game,
  editor,
  images,
  readOnly,
  onClose,
}: RoundEditorProps) {
  const m = t(prizesText);
  const c = t(commonText);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [round]);
  return (
    <Panel as="section" className={styles.editor} aria-labelledby={`round-editor-${round}`}>
      <div class={styles.editorHeader}>
        <h2 id={`round-editor-${round}`} ref={heading} tabIndex={-1}>
          {m.editor.title(round)}
        </h2>
        <Button onClick={onClose}>{m.editor.close}</Button>
      </div>
      <p class={styles.hint}>{m.liveHint}</p>
      <div class={styles.slots}>
        {slotsForRound(roundOf(game, round), catalogue).map((slot) => (
          <section
            key={`${round}-${slot}`}
            class={styles.slot}
            aria-labelledby={`slot-${round}-${slot}`}
          >
            <h3 id={`slot-${round}-${slot}`} class={styles.slotTitle}>
              {c.prizeSlot(slot)}
            </h3>
            <PrizeForm
              editor={editor}
              images={images}
              round={round}
              slot={slot}
              prize={prizeAt(catalogue, round, slot)}
              fallback={templateCondition(template, slot)}
              awarded={isAwarded(game, round, slot)}
              readOnly={readOnly}
            />
          </section>
        ))}
      </div>
    </Panel>
  );
}
