/** Selection and edit revisions isolate late responses even when transport cancellation fails. */
export class ExtractionAttempt {
  private selection = 0;
  private revision = 0;
  select() { this.selection += 1; this.revision = 0; return this.capture(); }
  edit() { this.revision += 1; }
  capture() { return { selection: this.selection, revision: this.revision }; }
  current(attempt: { selection: number }) { return attempt.selection === this.selection; }
  canApply(attempt: { selection: number; revision: number }) { return this.current(attempt) && attempt.revision === this.revision; }
}