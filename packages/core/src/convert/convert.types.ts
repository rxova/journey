export type LinearToGraphOptions = {
  /**
   * Linear journeys allow ungated `goToStepById`; graph gating narrows that.
   * When `true`, a `GO_TO_<ID>` event is generated per step with candidates
   * from every other step, preserving free jumps. Defaults to `false`
   * (accept the narrowing).
   */
  readonly includeJumpEvents?: boolean;
};
