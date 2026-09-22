/**
 * One question put to the judge. Every kind declares the `fallback` it takes
 * when the panel cannot answer it or the caller skips it.
 */
export type Question =
  | {
      readonly kind: "choice";
      readonly ask: string;
      /** Option key to what the option is. The keys are never shown to a model. */
      readonly options: Readonly<Record<string, string>>;
      /** An option key, or `"tie"`. */
      readonly fallback: string;
    }
  | {
      readonly kind: "score";
      readonly ask: string;
      /** What each level means, lowest first. A score is an index into this list. */
      readonly levels: readonly string[];
      readonly fallback: number;
    }
  | {
      readonly kind: "binary";
      readonly ask: string;
      /** What a yes means. */
      readonly yes: string;
      /** What a no means. */
      readonly no: string;
      /** A probability of yes, from 0 to 1. */
      readonly fallback: number;
    };

/**
 * Where an answer came from: a rule, the panel's samples, the question's
 * fallback because the panel fell short, or the fallback because the caller
 * skipped the question.
 */
export type Source = "rule" | "panel" | "abstained" | "skipped";

type OptionKey<Q> = Q extends { readonly options: infer O } ? Extract<keyof O, string> : never;

/** The part of an answer that depends on the question's kind. */
export type Decision<Q extends Question = Question> = Q extends { readonly kind: "choice" }
  ? {
      /** The winning option, or `"tie"` when no option won a clear majority. */
      readonly choice: OptionKey<Q> | "tie";
      /** Each option's summed sample weight. Empty for a rule or a fallback. */
      readonly votes: Partial<Record<OptionKey<Q>, number>>;
    }
  : Q extends { readonly kind: "score" }
    ? { readonly score: number }
    : { readonly probability: number };

/** The judge's answer to one question. */
export type Answer<Q extends Question = Question> = Decision<Q> & {
  /** From 0 to 1: how far the samples agreed, 1 for a rule, 0 for a fallback. */
  readonly confidence: number;
  /** True when the panel fell short and the answer is the question's fallback. */
  readonly abstained: boolean;
  readonly source: Source;
};

/**
 * What a rule returns to settle a question: the choice, score or probability,
 * and a confidence that defaults to 1. `votes` is never needed.
 */
export type RuleDecision<Q extends Question = Question> = (Q extends { readonly kind: "choice" }
  ? { readonly choice: OptionKey<Q> | "tie" }
  : Q extends { readonly kind: "score" }
    ? { readonly score: number }
    : { readonly probability: number }) & { readonly confidence?: number };

/**
 * A deterministic answer from the state. `decide` returns `undefined` to leave
 * the question to the next rule, and after the last rule to the panel.
 */
export type Rule<Q extends Question = Question, S = unknown> = {
  /** Names the rule in the trail. */
  readonly id: string;
  decide(state: S): RuleDecision<Q> | undefined;
};

/** What the judge sends one model for one sample. */
export type CompletionRequest = {
  readonly system: string;
  readonly prompt: string;
  /** JSON Schema of the reply, for a provider's structured-output or tool mode. */
  readonly schema: object;
  readonly temperature?: number;
  /** Aborted on the call's timeout and when the judgement stops. Pass it on. */
  readonly signal: AbortSignal;
};

/** One model on the panel. The judge has no provider SDK; `complete` is yours. */
export type JudgeModel = {
  readonly id: string;
  /** How much this model's vote counts in a choice or binary answer. Defaults to 1. */
  readonly weight?: number;
  /** Resolves with the model's raw reply text. */
  complete(request: CompletionRequest): Promise<string>;
};

export type JudgeOptions = {
  /** At least one model. Samples go to the models in turn. */
  readonly panel: readonly JudgeModel[];
  /**
   * Samples per round. Defaults to the smallest multiple of the largest option
   * count that is at least 3, so every option sits in every position equally often.
   */
  readonly samples?: number;
  /** Passed to each call. Defaults to 0.7. */
  readonly temperature?: number;
  /** Rounds of repair prompts for a reply that failed validation. Defaults to 1. */
  readonly repairAttempts?: number;
  /** Valid samples a question needs to be answered. Defaults to half the samples, rounded up. */
  readonly quorum?: number;
  /** Model calls one judgement may make, retries and repairs included. Defaults to 4 × samples. */
  readonly maxCalls?: number;
  /** Calls in flight at once. Defaults to 4. */
  readonly concurrency?: number;
  /** Budget for one call, in milliseconds. A call past it is retried once. */
  readonly timeoutMs?: number;
  /** Longest serialized state put in a prompt; the rest is cut. Defaults to 60 000. */
  readonly maxStateChars?: number;
};

/** One call's reply, read against the questions it was asked. */
export type Sample = {
  /** `s<round>.<position>`, counted from 1. */
  readonly id: string;
  readonly model: string;
  readonly round: number;
  /**
   * The sample's position in its round. It sets the option order the model saw
   * and which panel model was asked.
   */
  readonly rotation: number;
  /** The raw reply, or `null` when the call failed. */
  readonly reply: string | null;
  /** Repair prompts this sample took. */
  readonly repairs: number;
  /** The questions this sample was asked. */
  readonly asked: readonly string[];
  /** Each question's valid value: an option key, a score, or a probability. */
  readonly values: Readonly<Record<string, string | number>>;
  /** Why a question has no value, by question. Empty when every value is valid. */
  readonly errors: Readonly<Record<string, string>>;
};

/** How one question was answered. */
export type TrailEntry = {
  readonly source: Source;
  /** The rule that settled it. */
  readonly rule?: string;
  /** The samples that held a valid value for it. */
  readonly samples?: readonly string[];
};

/** How a judgement ran, for a log or a review. */
export type JudgeTrail = {
  /** The judge's steps, in the order the machine took them. */
  readonly path: readonly string[];
  readonly answers: Readonly<Record<string, TrailEntry>>;
  readonly samples: readonly Sample[];
  readonly calls: number;
};

export type AskInput<S, Qs extends Record<string, Question>> = {
  /** What the questions are about. Serialized into the prompt as untrusted JSON. */
  readonly state: S;
  readonly questions: Qs;
  /** Stops the judgement: calls in flight are aborted and `ask` rejects with `aborted`. */
  readonly signal?: AbortSignal;
  /** Tried in order before the panel is asked; the first to answer settles the question. */
  // NoInfer: the questions alone decide `Qs` and the state alone `S`; a rule
  // is checked against them, never widens them.
  readonly rules?: NoInfer<{ readonly [K in keyof Qs]?: readonly Rule<Qs[K], S>[] }>;
  /** Questions whose answer cannot matter now: they take their fallback without a call. */
  readonly skip?: NoInfer<readonly (keyof Qs & string)[]>;
};

export type Judgement<Qs extends Record<string, Question>> = {
  readonly answers: { readonly [K in keyof Qs]: Answer<Qs[K]> };
  readonly calls: number;
  readonly trail: JudgeTrail;
};
