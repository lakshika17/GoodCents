import { describe, expect, it } from 'vitest';
import { ExtractionAttempt } from './extraction-attempt';
describe('extraction response isolation', () => {
  it('ignores A after selecting B even if A finishes last', () => { const guard = new ExtractionAttempt(); const a = guard.select(); const b = guard.select(); expect(guard.canApply(b)).toBe(true); expect(guard.current(a)).toBe(false); });
  it('cannot restore earlier values after replacement failure', () => { const guard = new ExtractionAttempt(); const a = guard.select(); guard.select(); expect(guard.canApply(a)).toBe(false); });
  it('keeps manual corrections from late extraction', () => { const guard = new ExtractionAttempt(); const a = guard.select(); guard.edit(); expect(guard.canApply(a)).toBe(false); expect(guard.current(a)).toBe(true); });
});