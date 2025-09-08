import { describe, it, expect } from 'vitest';
import { isLegalTransition, isTerminal, type JobStatus } from './job-state';

describe('job-state', () => {
  const t = (from: JobStatus, to: JobStatus, ok: boolean) => {
    expect(isLegalTransition(from, to)).toBe(ok);
  };

  it('transitions', () => {
    t('pending', 'processing', true);
    t('pending', 'completed', true);
    t('pending', 'failed', true);
    t('processing', 'completed', true);
    t('processing', 'failed', true);
    t('completed', 'failed', false);
    t('failed', 'completed', false);
    t('completed', 'processing', false);
  });

  it('terminal detection', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('pending')).toBe(false);
    expect(isTerminal('processing')).toBe(false);
  });
});

