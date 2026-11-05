import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ImageStore } from '../../../application/ports';
import type { PrizeEditError, PrizeEditor } from '../../../application/prize-editor';
import type { Prize, PrizeSlot, WinCondition, WinConditionKind } from '../../../domain/types';
import { commonText } from '../../../i18n/catalogues';
import { conditionLabel } from '../../../i18n/labels';
import { formatChf } from '../../../i18n/format';
import { t } from '../../../i18n';
import { Button } from '../../design-system/Button';
import { SelectField, TextArea, TextField } from '../../design-system/Field';
import { PrizeImage } from '../../design-system/PrizeImage';
import { showToast } from '../../design-system/toast-store';
import {
  draftFromValues,
  formValues,
  sameValues,
  type PrizeFormErrors,
  type PrizeFormValues,
} from './form-state';
import { ImageField } from './ImageField';
import styles from './PrizeForm.module.css';
import { prizesText } from './text';

export interface PrizeFormProps {
  readonly editor: PrizeEditor;
  readonly images: ImageStore;
  readonly round: number;
  readonly slot: PrizeSlot;
  readonly prize: Prize | undefined;
  /** Template condition used for a gap. */
  readonly fallback: WinCondition;
  readonly awarded: boolean;
  readonly readOnly: boolean;
}

const KINDS: readonly WinConditionKind[] = ['ONE_LINE', 'TWO_LINES', 'FULL_CARD', 'CUSTOM'];

function AwardedView({
  prize,
  images,
}: {
  readonly prize: Prize | undefined;
  readonly images: ImageStore;
}) {
  const m = t(prizesText);
  const c = t(commonText);
  if (prize === undefined) return <p class={styles.notice}>{m.editor.awarded}</p>;
  return (
    <div class={styles.awarded}>
      <p class={styles.notice}>{m.editor.awarded}</p>
      <PrizeImage
        images={images}
        imageId={prize.imageId}
        alt={m.image.alt(prize.title)}
        size="md"
      />
      <p class={styles.awardedTitle}>{prize.title}</p>
      {prize.description !== undefined && <p>{prize.description}</p>}
      <p>
        {conditionLabel(prize.winCondition, c)}
        {prize.valueChf === undefined ? '' : ` · ${formatChf(prize.valueChf)}`}
        {prize.sponsor === undefined ? '' : ` · ${m.print.sponsor(prize.sponsor)}`}
      </p>
    </div>
  );
}

/** Editor for one prize slot (FR-8): validated fields, image, win condition; awarded = read-only. */
export function PrizeForm({
  editor,
  images,
  round,
  slot,
  prize,
  fallback,
  awarded,
  readOnly,
}: PrizeFormProps) {
  const m = t(prizesText);
  const c = t(commonText);
  const slotLabel = c.prizeSlot(slot);
  const stored = useMemo(() => formValues(prize, fallback), [prize, fallback]);
  const [baseline, setBaseline] = useState<PrizeFormValues>(stored);
  const [values, setValues] = useState<PrizeFormValues>(stored);
  const [errors, setErrors] = useState<PrizeFormErrors>({});
  const uploaded = useRef<string | undefined>(undefined);

  useEffect(() => {
    // The stored prize changed elsewhere: follow it unless the form has unsaved edits.
    if (sameValues(stored, baseline)) return;
    if (sameValues(values, baseline)) setValues(stored);
    setBaseline(stored);
  }, [stored, baseline, values]);

  useEffect(
    () => () => {
      if (uploaded.current !== undefined) editor.releaseImage(uploaded.current);
    },
    [editor],
  );

  if (awarded) return <AwardedView prize={prize} images={images} />;
  const dirty = !sameValues(values, baseline);
  const set = (patch: Partial<PrizeFormValues>) => {
    setValues({ ...values, ...patch });
  };
  const releaseUpload = () => {
    if (uploaded.current !== undefined) editor.releaseImage(uploaded.current);
    uploaded.current = undefined;
  };
  const report = (error: PrizeEditError) => {
    showToast(m.errors[error.code], { tone: 'error' });
  };
  const save = () => {
    const parsed = draftFromValues(values, m);
    if ('errors' in parsed) {
      setErrors(parsed.errors);
      return;
    }
    const result = editor.savePrize(round, slot, parsed.draft);
    if (!result.ok) {
      report(result.error);
      return;
    }
    uploaded.current = undefined;
    setErrors({});
    showToast(m.form.saved(slotLabel), { tone: 'success' });
  };
  return (
    <form
      class={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {prize === undefined && <p class={styles.notice}>{m.editor.gap(slotLabel)}</p>}
      <fieldset class={styles.fieldset} disabled={readOnly}>
        <TextField
          label={m.form.title}
          value={values.title}
          onValue={(title) => {
            set({ title });
          }}
          hint={m.form.titleHint}
          error={errors.title}
        />
        <TextArea
          label={m.form.description}
          value={values.description}
          onValue={(description) => {
            set({ description });
          }}
          error={errors.description}
        />
        <div class={styles.row}>
          <TextField
            label={m.form.value}
            value={values.valueText}
            onValue={(text) => {
              set({ valueText: text });
            }}
            inputMode="decimal"
            hint={m.form.valueHint}
            error={errors.value}
          />
          <TextField
            label={m.form.sponsor}
            value={values.sponsor}
            onValue={(sponsor) => {
              set({ sponsor });
            }}
            error={errors.sponsor}
          />
        </div>
        <SelectField
          label={m.form.condition}
          value={values.conditionKind}
          options={KINDS.map((kind) => ({ value: kind, label: c.conditions[kind] }))}
          onValue={(conditionKind) => {
            set({ conditionKind });
          }}
        />
        {values.conditionKind === 'CUSTOM' && (
          <TextField
            label={m.form.customLabel}
            value={values.customLabel}
            onValue={(customLabel) => {
              set({ customLabel });
            }}
            error={errors.customLabel}
          />
        )}
        <ImageField
          editor={editor}
          images={images}
          imageId={values.imageId}
          title={values.title}
          disabled={readOnly}
          onChange={(imageId) => {
            releaseUpload();
            uploaded.current = imageId;
            set({ imageId });
          }}
        />
      </fieldset>
      <div class={styles.actions}>
        <Button type="submit" variant="primary" disabled={readOnly || !dirty}>
          {m.form.save}
        </Button>
        {dirty && (
          <Button
            disabled={readOnly}
            onClick={() => {
              releaseUpload();
              setValues(baseline);
              setErrors({});
            }}
          >
            {m.form.discard}
          </Button>
        )}
        {prize !== undefined && (
          <Button
            variant="danger"
            disabled={readOnly}
            onClick={() => {
              const result = editor.removePrize(round, slot);
              if (!result.ok) report(result.error);
              else showToast(m.form.removed(slotLabel), { tone: 'success' });
            }}
          >
            {m.form.remove}
          </Button>
        )}
      </div>
    </form>
  );
}
