import { useState } from 'preact/hooks';
import type { PrizeEditError, PrizeEditor } from '../../../application/prize-editor';
import type { BulkResult } from '../../../domain/catalogue';
import type { Result } from '../../../domain/result';
import { commonText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { SelectField, TextField } from '../../design-system/Field';
import { showToast } from '../../design-system/toast-store';
import { parseRoundList } from './form-state';
import { prizesText } from './text';

type Tool = 'copy' | 'template' | 'clear';

export interface BulkToolsProps {
  readonly editor: PrizeEditor;
  readonly rounds: number;
  readonly selected: number | undefined;
  readonly readOnly: boolean;
}

function roundOptions(rounds: number) {
  return Array.from({ length: rounds }, (_, index) => ({
    value: String(index + 1),
    label: String(index + 1),
  }));
}

/** Copy a round, apply the win-condition template everywhere, clear a round (FR-8). */
export function BulkTools({ editor, rounds, selected, readOnly }: BulkToolsProps) {
  const m = t(prizesText);
  const c = t(commonText);
  const [tool, setTool] = useState<Tool | undefined>(undefined);
  const [from, setFrom] = useState(String(selected ?? 1));
  const [targets, setTargets] = useState('');
  const [targetError, setTargetError] = useState<string | undefined>(undefined);
  const open = (next: Tool) => {
    setFrom(String(selected ?? 1));
    setTargets('');
    setTargetError(undefined);
    setTool(next);
  };
  const close = () => {
    setTool(undefined);
  };
  const finish = (result: Result<BulkResult, PrizeEditError>, success: string) => {
    if (!result.ok) {
      showToast(m.errors[result.error.code], { tone: 'error' });
      return;
    }
    const skipped = result.value.skipped.length;
    showToast(skipped > 0 ? `${success}. ${m.bulk.skipped(skipped)}` : success, {
      tone: 'success',
    });
    close();
  };
  const confirmCopy = () => {
    const list = parseRoundList(targets, rounds)?.filter((round) => round !== Number(from));
    if (list === undefined || list.length === 0) {
      setTargetError(m.bulk.roundsInvalid);
      return;
    }
    finish(editor.copyRound(Number(from), list), m.bulk.copied(list.length));
  };
  const options = roundOptions(rounds);
  return (
    <div class="no-print">
      <h2 class="visually-hidden">{m.bulk.title}</h2>
      <Button
        disabled={readOnly}
        onClick={() => {
          open('copy');
        }}
      >
        {m.bulk.copy}
      </Button>{' '}
      <Button
        disabled={readOnly}
        onClick={() => {
          open('template');
        }}
      >
        {m.bulk.template}
      </Button>{' '}
      <Button
        disabled={readOnly}
        onClick={() => {
          open('clear');
        }}
      >
        {m.bulk.clear}
      </Button>
      <Dialog
        open={tool === 'copy'}
        title={m.bulk.copy}
        onClose={close}
        actions={
          <>
            <Button onClick={close}>{c.actions.cancel}</Button>
            <Button variant="primary" onClick={confirmCopy}>
              {m.bulk.copyConfirm}
            </Button>
          </>
        }
      >
        <p>{m.bulk.copyBody}</p>
        <SelectField label={m.bulk.copyFrom} value={from} options={options} onValue={setFrom} />
        <TextField
          label={m.bulk.copyTo}
          value={targets}
          onValue={setTargets}
          error={targetError}
          autoComplete="off"
        />
      </Dialog>
      <Dialog
        open={tool === 'template'}
        title={m.bulk.template}
        onClose={close}
        actions={
          <>
            <Button onClick={close}>{c.actions.cancel}</Button>
            <Button
              variant="primary"
              onClick={() => {
                finish(editor.applyTemplateEverywhere(), m.bulk.templated);
              }}
            >
              {m.bulk.templateConfirm}
            </Button>
          </>
        }
      >
        <p>{m.bulk.templateBody}</p>
      </Dialog>
      <Dialog
        open={tool === 'clear'}
        title={m.bulk.clear}
        tone="danger"
        onClose={close}
        actions={
          <>
            <Button onClick={close}>{c.actions.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                finish(editor.clearRound(Number(from)), m.bulk.cleared(Number(from)));
              }}
            >
              {m.bulk.clearConfirm}
            </Button>
          </>
        }
      >
        <p>{m.bulk.clearBody}</p>
        <SelectField label={m.bulk.clearRound} value={from} options={options} onValue={setFrom} />
      </Dialog>
    </div>
  );
}
