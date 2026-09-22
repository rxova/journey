import { withGraphTypes, type GraphDefinition } from "@rxova/journey-core";
import { judgeDefinition, type JudgeBag, type JudgeEnv } from "./engine";
import { JudgeError } from "./errors";
import { defaultSamples, MAX_OPTIONS } from "./reply";
import type { AskInput, JudgeOptions, Judgement, Question } from "./types";

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_STATE_CHARS = 60_000;

const isCount = (value: number | undefined, min: number) =>
  value === undefined || (Number.isInteger(value) && value >= min);

function check(ok: boolean, message: string): void {
  if (!ok) throw new JudgeError("invalid", message);
}

function checkOptions(options: JudgeOptions): void {
  check(options.panel.length > 0, "createJudge: the panel needs at least one model");
  check(isCount(options.samples, 1), "createJudge: samples must be a positive integer");
  check(isCount(options.repairAttempts, 0), "createJudge: repairAttempts must be an integer ≥ 0");
  check(isCount(options.quorum, 1), "createJudge: quorum must be a positive integer");
  check(isCount(options.maxCalls, 1), "createJudge: maxCalls must be a positive integer");
  check(isCount(options.concurrency, 1), "createJudge: concurrency must be a positive integer");
  check(isCount(options.maxStateChars, 1), "createJudge: maxStateChars must be a positive integer");
  const { timeoutMs } = options;
  check(
    timeoutMs === undefined || (timeoutMs > 0 && Number.isFinite(timeoutMs)),
    "createJudge: timeoutMs must be a positive finite number"
  );
}

function checkQuestion(key: string, question: Question): void {
  const at = `ask: question "${key}"`;
  if (question.kind === "choice") {
    const keys = Object.keys(question.options);
    check(
      keys.length >= 2 && keys.length <= MAX_OPTIONS,
      `${at} needs 2 to ${String(MAX_OPTIONS)} options`
    );
    check(
      question.fallback === "tie" || keys.includes(question.fallback),
      `${at} has a fallback that is neither an option nor "tie"`
    );
  } else if (question.kind === "score") {
    check(question.levels.length >= 2, `${at} needs at least 2 levels`);
    check(
      Number.isInteger(question.fallback) &&
        question.fallback >= 0 &&
        question.fallback < question.levels.length,
      `${at} has a fallback that is not a level`
    );
  } else {
    check(question.fallback >= 0 && question.fallback <= 1, `${at} has a fallback outside 0 to 1`);
  }
}

/** Why a machine that was meant to reach `done` ended instead. */
function failure(payload: unknown, signal: AbortSignal | undefined): unknown {
  if (signal?.aborted) {
    return new JudgeError("aborted", "ask: aborted", { cause: signal.reason });
  }
  const { error } = payload as { readonly error: unknown };
  return error;
}

/**
 * A judge: rules settle what they can, then a panel of models answers the
 * rest by sampling. Each `ask` is one run of a Journey graph, so the path it
 * took is the trail. Nothing here calls a provider: each panel model brings
 * its own `complete`.
 *
 * @example
 * ```ts
 * const judge = createJudge({ panel: [{ id: "a", complete: callModelA }] });
 * const { answers } = await judge.ask({
 *   state: { plans },
 *   questions: {
 *     stronger: {
 *       kind: "choice",
 *       ask: "Which plan is stronger?",
 *       options: { first: "the first plan", second: "the second plan" },
 *       fallback: "tie"
 *     }
 *   }
 * });
 * answers.stronger.choice; // "first" | "second" | "tie"
 * ```
 */
export function createJudge(options: JudgeOptions): {
  /**
   * Answers each question. Rejects with a {@link JudgeError}: `invalid` for an
   * input that cannot be judged, `unreachable` when every call of a sample
   * round failed, `aborted` when `signal` aborts. An error a rule throws is
   * rethrown as it is.
   */
  ask<S, const Qs extends Record<string, Question>>(input: AskInput<S, Qs>): Promise<Judgement<Qs>>;
  /** The judge's graph definition, for `analyzeStructure` and the devtools. */
  readonly definition: GraphDefinition<JudgeBag>;
} {
  checkOptions(options);

  async function ask<S, const Qs extends Record<string, Question>>(
    input: AskInput<S, Qs>
  ): Promise<Judgement<Qs>> {
    const { questions, signal } = input;
    const keys = Object.keys(questions);
    check(keys.length > 0, "ask: no questions");
    for (const key of keys) checkQuestion(key, questions[key] as Question);
    const skip = input.skip ?? [];
    for (const key of skip) check(keys.includes(key), `ask: skip names no question "${key}"`);
    if (signal?.aborted) throw failure(undefined, signal);

    const samples = options.samples ?? defaultSamples(questions);
    const maxCalls = options.maxCalls ?? 4 * samples;
    const env: JudgeEnv = {
      state: input.state,
      questions,
      rules: (input.rules ?? {}) as JudgeEnv["rules"],
      skip,
      panel: options.panel,
      samples,
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      repairAttempts: options.repairAttempts ?? 1,
      quorum: options.quorum ?? Math.ceil(samples / 2),
      maxCalls,
      concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
      timeoutMs: options.timeoutMs,
      maxStateChars: options.maxStateChars ?? DEFAULT_MAX_STATE_CHARS
    };

    const machine = withGraphTypes<JudgeBag>()(judgeDefinition, {
      handlers: env,
      autoStart: false,
      onError: "terminate",
      // A round is at most sample, repair and aggregate, and each round makes a
      // call; rules, abstain and done add three. `maxCalls` bounds the rest.
      maxAutoSteps: 3 * maxCalls + 3
    });
    // `complete` is refused while a transition is pending, and `stepEnter`
    // fires before the entry settles: wait for the snapshot that settles it.
    const unsubscribe = machine.subscriptions.subscribe(() => {
      const { currentStep, transition } = machine.getSnapshot();
      if (currentStep?.id === "done" && !transition.pending) machine.controls.complete();
    });
    const onAbort = () => {
      machine.controls.terminate();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      machine.controls.start();
      const outcome = await machine.settled();
      if (outcome.type === "terminated") throw failure(outcome.payload, signal);
      const { context, history } = machine.getSnapshot();
      return {
        answers: context.answers as unknown as Judgement<Qs>["answers"],
        calls: context.calls,
        trail: {
          path: history.timeline,
          answers: context.trail,
          samples: context.samples,
          calls: context.calls
        }
      };
    } finally {
      unsubscribe();
      signal?.removeEventListener("abort", onAbort);
      machine.dispose();
    }
  }

  return { ask, definition: judgeDefinition };
}
