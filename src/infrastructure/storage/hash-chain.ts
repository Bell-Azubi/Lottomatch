import type { ChainVerification } from '../../application/ports';
import { canonicalJson } from '../../domain/canonical-json';
import type { LogEnvelope } from '../../domain/types';
import { REDACTABLE_WINNER_FIELDS } from '../../domain/types';

function withoutPersonalData(winners: unknown): unknown {
  if (!Array.isArray(winners)) return winners;
  const redactable: readonly string[] = REDACTABLE_WINNER_FIELDS;
  return winners.map((winner: unknown) => {
    if (typeof winner !== 'object' || winner === null) return winner;
    return Object.fromEntries(Object.entries(winner).filter(([key]) => !redactable.includes(key)));
  });
}

/**
 * Canonical text that the hash chain covers: sorted keys, no hash fields, and no personal data,
 * so names can be erased (C6) without breaking the chain (ADR-0005).
 */
export function hashInput(envelope: LogEnvelope): string {
  const { hash: _hash, prevHash: _prev, event, ...rest } = envelope;
  const record: Record<string, unknown> = { ...event };
  if ('winners' in record) record['winners'] = withoutPersonalData(record['winners']);
  if ('claimants' in record) record['claimants'] = withoutPersonalData(record['claimants']);
  return canonicalJson({ ...rest, event: record });
}

/** Computes the chained hash of an envelope from the previous hash. */
export async function chainHash(
  envelope: LogEnvelope,
  prevHash: string | undefined,
  sha256Hex: (text: string) => Promise<string>,
): Promise<string> {
  return sha256Hex(`${prevHash ?? ''}\n${hashInput(envelope)}`);
}

/** Verifies a stored log: every envelope must carry the hash of its predecessor and itself. */
export async function verifyChain(
  log: readonly LogEnvelope[],
  sha256Hex: (text: string) => Promise<string>,
): Promise<ChainVerification> {
  let previous: string | undefined;
  for (const envelope of log) {
    if (envelope.prevHash !== previous || envelope.hash === undefined)
      return { ok: false, brokenAt: envelope.seq };
    const expected = await chainHash(envelope, previous, sha256Hex);
    if (expected !== envelope.hash) return { ok: false, brokenAt: envelope.seq };
    previous = envelope.hash;
  }
  return { ok: true, checked: log.length };
}
