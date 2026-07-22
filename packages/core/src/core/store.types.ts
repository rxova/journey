import type { JourneySnapshot } from "./types";

export type SelectorEntry<TContext, TStepId extends string> = {
  selector: (snapshot: JourneySnapshot<TContext, TStepId>) => unknown;
  listener: (selected: never) => void;
  equals: (a: unknown, b: unknown) => boolean;
  last: unknown;
};
