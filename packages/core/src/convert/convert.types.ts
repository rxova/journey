/**
 * The event union a converted linear definition declares: `NEXT`/`PREVIOUS`,
 * plus a `GO_TO_<ID>` per step when `includeJumpEvents` is set. Naming it keeps
 * `send()` typed after the conversion instead of collapsing to `string`.
 */
export type LinearGraphEvent<TStepId extends string> =
  | { readonly type: "NEXT" }
  | { readonly type: "PREVIOUS" }
  | { readonly type: `GO_TO_${TStepId}` };

export type LinearToGraphOptions = {
  /**
   * Linear journeys allow ungated `goToStepById`; graph gating narrows that.
   * When `true`, a `GO_TO_<ID>` event is generated per step with candidates
   * from every other step, preserving free jumps. Defaults to `false`
   * (accept the narrowing).
   */
  readonly includeJumpEvents?: boolean;
};
