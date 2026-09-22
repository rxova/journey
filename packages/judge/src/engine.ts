import { defineAlways, retry, type GraphDefinition } from "@rxova/journey-core";
import { combineBinary, combineChoice, combineScore } from "./aggregate";
import { JudgeError } from "./errors";
import { repairPrompt, samplePrompt, SYSTEM_PROMPT } from "./prompt";
import { readReply, replySchema } from "./reply";
import type { Answer, JudgeModel, Question, RuleDecision, Sample, TrailEntry } from "./types";

/** One `ask`, resolved: the input and the judge's settings. The machine's `handlers`. */
export type JudgeEnv = {
  readonly state: unknown;
  readonly questions: Readonly<Record<string, Question>>;
  readonly rules: Readonly<
    Record<
      string,
      | readonly { readonly id: string; decide(state: unknown): RuleDecision | undefined }[]
      | undefined
    >
  >;
  readonly skip: readonly string[];
  readonly panel: readonly JudgeModel[];
  readonly samples: number;
  readonly temperature: number;
  readonly repairAttempts: number;
  readonly quorum: number;
  readonly maxCalls: number;
  readonly concurrency: number;
  readonly timeoutMs: number | undefined;
  readonly maxStateChars: number;
};

/** Only data the run produced, so a snapshot of it is the judgement so far. */
export type JudgeContext = {
  readonly answers: Readonly<Record<string, Answer>>;
  readonly trail: Readonly<Record<string, TrailEntry>>;
  /** The questions the next sample round asks, or that `abstain` answers. */
  readonly open: readonly string[];
  readonly samples: readonly Sample[];
  readonly calls: number;
  readonly round: number;
};

/** The judge graph's steps. `done` is the terminal step; `ask` completes the run there. */
export type JudgeStepId = "rules" | "sample" | "repair" | "aggregate" | "abstain" | "done";

/** The judge graph's type bag, for `withGraphTypes` and `GraphDefinition`. */
export type JudgeBag = {
  context: JudgeContext;
  stepId: JudgeStepId;
  events: never;
  handlers: JudgeEnv;
};

const always = defineAlways<JudgeBag>();

function fallback(question: Question, source: "abstained" | "skipped"): Answer {
  const base = { confidence: 0, abstained: source === "abstained", source } as const;
  if (question.kind === "choice") return { choice: question.fallback, votes: {}, ...base };
  if (question.kind === "score") return { score: question.fallback, ...base };
  return { probability: question.fallback, ...base };
}

function fromRule(question: Question, decision: RuleDecision): Answer {
  const base = { confidence: decision.confidence ?? 1, abstained: false, source: "rule" } as const;
  if (question.kind === "choice" && "choice" in decision) {
    return { choice: decision.choice, votes: {}, ...base };
  }
  if (question.kind === "score" && "score" in decision) return { score: decision.score, ...base };
  if (question.kind === "binary" && "probability" in decision) {
    return { probability: decision.probability, ...base };
  }
  throw new JudgeError(
    "invalid",
    `a rule answered "${question.kind}" question with the wrong shape`
  );
}

/** Skipped questions take their fallback; the first rule to answer settles the rest it can. */
function settle(env: JudgeEnv) {
  const answers: Record<string, Answer> = {};
  const trail: Record<string, TrailEntry> = {};
  const open: string[] = [];
  for (const [key, question] of Object.entries(env.questions)) {
    if (env.skip.includes(key)) {
      answers[key] = fallback(question, "skipped");
      trail[key] = { source: "skipped" };
      continue;
    }
    for (const rule of env.rules[key] ?? []) {
      const decision = rule.decide(env.state);
      if (decision === undefined) continue;
      try {
        answers[key] = fromRule(question, decision);
      } catch (error) {
        throw new JudgeError(
          "invalid",
          `rule "${rule.id}" on "${key}": ${(error as Error).message}`
        );
      }
      trail[key] = { source: "rule", rule: rule.id };
      break;
    }
    if (!(key in answers)) open.push(key);
  }
  return { answers, trail, open };
}

/** Runs `task` for 0‥count-1, at most `limit` at once, keeping the results in order. */
async function pool<T>(count: number, limit: number, task: (index: number) => Promise<T>) {
  const results: T[] = [];
  let next = 0;
  const worker = async () => {
    while (next < count) {
      const index = next;
      next += 1;
      results[index] = await task(index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, count) }, worker));
  return results;
}

type Budget = { calls: number; reserved: number };

/**
 * A model call that counts itself against `maxCalls` and is tried again once
 * on failure while the budget allows. Each try has its own timeout. Every call
 * is reserved before it runs: a round reserves its first tries up front, and a
 * retry reserves its call when it is granted, so a retry never takes a call a
 * first try still needs.
 */
function caller(env: JudgeEnv, budget: Budget) {
  type CallArgs = {
    readonly signal: AbortSignal;
    readonly model: JudgeModel;
    readonly prompt: string;
    readonly schema: object;
  };
  return retry<CallArgs, string>(
    ({ signal, model, prompt, schema }) => {
      budget.reserved -= 1;
      budget.calls += 1;
      return model.complete({
        system: SYSTEM_PROMPT,
        prompt,
        schema,
        temperature: env.temperature,
        signal
      });
    },
    {
      attempts: 2,
      ...(env.timeoutMs === undefined ? {} : { timeoutMs: env.timeoutMs }),
      when: () => {
        if (budget.calls + budget.reserved >= env.maxCalls) return false;
        budget.reserved += 1;
        return true;
      }
    }
  );
}

const modelAt = (env: JudgeEnv, rotation: number) =>
  env.panel[rotation % env.panel.length] as JudgeModel;

const promptFor = (env: JudgeEnv, sample: Pick<Sample, "asked" | "rotation">) =>
  samplePrompt(env.state, env.questions, sample.asked, sample.rotation, env.maxStateChars);

/**
 * One round: a sample per rotation, spread over the panel. A failed call is a
 * sample with no reply; a round in which every call failed rejects, and the
 * judgement ends as `unreachable`.
 */
async function sampleRound(context: JudgeContext, env: JudgeEnv, signal: AbortSignal) {
  const round = context.round + 1;
  const asked = context.open;
  const count = Math.min(env.samples, env.maxCalls - context.calls);
  const budget: Budget = { calls: context.calls, reserved: count };
  const call = caller(env, budget);
  const schema = replySchema(env.questions, asked);
  let lastError: unknown;
  const samples = await pool(count, env.concurrency, async (rotation): Promise<Sample> => {
    const model = modelAt(env, rotation);
    const base = {
      id: `s${String(round)}.${String(rotation + 1)}`,
      model: model.id,
      round,
      rotation,
      repairs: 0,
      asked
    };
    try {
      const reply = await call({ signal, model, prompt: promptFor(env, base), schema });
      return { ...base, reply, ...readReply(reply, env.questions, asked, rotation) };
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
      const errors = Object.fromEntries(asked.map((key) => [key, "the call failed"]));
      return { ...base, reply: null, values: {}, errors };
    }
  });
  if (samples.every((sample) => sample.reply === null)) {
    throw new JudgeError("unreachable", `every call of sample round ${String(round)} failed`, {
      cause: lastError
    });
  }
  return { samples, calls: budget.calls, round };
}

const needsRepair = (sample: Sample, round: number) =>
  sample.round === round && sample.reply !== null && Object.keys(sample.errors).length > 0;

/**
 * Up to `repairAttempts` passes over the round's invalid replies, each shown to
 * its model with what was wrong. A value a sample already had stands; a
 * repaired reply only fills the gaps. A repair call that fails leaves the sample as it was.
 */
async function repairRound(context: JudgeContext, env: JudgeEnv, signal: AbortSignal) {
  const budget: Budget = { calls: context.calls, reserved: 0 };
  const call = caller(env, budget);
  const samples = [...context.samples];
  for (let pass = 0; pass < env.repairAttempts; pass += 1) {
    const targets = samples.flatMap((sample, index) =>
      needsRepair(sample, context.round) ? [index] : []
    );
    // Never a negative end: slice would count it from the back.
    const batch = targets.slice(0, Math.max(0, env.maxCalls - budget.calls));
    if (batch.length === 0) break;
    budget.reserved = batch.length;
    await pool(batch.length, env.concurrency, async (position) => {
      const index = batch[position] as number;
      const sample = samples[index] as Sample;
      const prompt = repairPrompt(promptFor(env, sample), sample.reply as string, sample.errors);
      let reply: string;
      try {
        reply = await call({
          signal,
          model: modelAt(env, sample.rotation),
          prompt,
          schema: replySchema(env.questions, sample.asked)
        });
      } catch (error) {
        if (signal.aborted) throw error;
        samples[index] = { ...sample, repairs: sample.repairs + 1 };
        return;
      }
      const fresh = readReply(reply, env.questions, sample.asked, sample.rotation);
      const values = { ...fresh.values, ...sample.values };
      const errors = Object.fromEntries(
        Object.entries(fresh.errors).filter(([key]) => !(key in values))
      );
      samples[index] = { ...sample, reply, values, errors, repairs: sample.repairs + 1 };
    });
  }
  return { samples, calls: budget.calls };
}

/** One question's answer from its valid samples, by the rule for its kind. */
function combine(question: Question, key: string, valid: readonly Sample[], env: JudgeEnv) {
  const weighted = <T>(value: (raw: string | number) => T) =>
    valid.map((sample) => ({
      value: value(sample.values[key] as string | number),
      weight: modelAt(env, sample.rotation).weight ?? 1
    }));
  if (question.kind === "choice") return combineChoice(weighted(String));
  if (question.kind === "binary") return combineBinary(weighted(Number));
  return combineScore(
    valid.map((sample) => sample.values[key] as number),
    question.levels.length
  );
}

/**
 * Combines every sample's value for each open question. A question with fewer
 * valid values than the quorum stays open, for another round or for `abstain`.
 */
function aggregate(context: JudgeContext, env: JudgeEnv) {
  const answers: Record<string, Answer> = {};
  const trail: Record<string, TrailEntry> = {};
  const short: string[] = [];
  for (const key of context.open) {
    const question = env.questions[key] as Question;
    const valid = context.samples.filter((sample) => key in sample.values);
    if (valid.length < env.quorum) {
      short.push(key);
      continue;
    }
    answers[key] = { ...combine(question, key, valid, env), abstained: false, source: "panel" };
    trail[key] = { source: "panel", samples: valid.map((sample) => sample.id) };
  }
  return { answers, trail, short };
}

function abstain(context: JudgeContext, env: JudgeEnv) {
  const answers: Record<string, Answer> = {};
  const trail: Record<string, TrailEntry> = {};
  for (const key of context.open) {
    answers[key] = fallback(env.questions[key] as Question, "abstained");
    const samples = context.samples.filter((s) => key in s.values).map((s) => s.id);
    trail[key] = { source: "abstained", samples };
  }
  return { answers, trail };
}

const hasBudget = (context: JudgeContext, env: JudgeEnv) => context.calls < env.maxCalls;

/**
 * The judge as a graph. Every step moves on its own, so a judgement is one
 * `start()` and a wait for the terminal `done` step. The only cycle is
 * `aggregate` → `sample`, bounded by `maxCalls`.
 */
export const judgeDefinition: GraphDefinition<JudgeBag> = {
  initial: "rules",
  context: { answers: {}, trail: {}, open: [], samples: [], calls: 0, round: 0 },
  steps: {
    rules: {
      always: always({
        label: "rules",
        run: ({ handlers }) => settle(handlers),
        commit: ({ result, updateContext }) => {
          updateContext((context) => ({ ...context, ...result }));
        },
        candidates: [
          { to: "sample", label: "open", when: ({ context }) => context.open.length > 0 },
          { to: "done" }
        ]
      })
    },
    sample: {
      always: always({
        label: "sample",
        run: ({ snapshot, handlers, signal }) => sampleRound(snapshot.context, handlers, signal),
        commit: ({ result, updateContext }) => {
          updateContext((context) => ({
            ...context,
            samples: [...context.samples, ...result.samples],
            calls: result.calls,
            round: result.round
          }));
        },
        candidates: [
          {
            to: "repair",
            label: "invalid",
            when: ({ context, handlers }) =>
              handlers.repairAttempts > 0 &&
              hasBudget(context, handlers) &&
              context.samples.some((sample) => needsRepair(sample, context.round))
          },
          { to: "aggregate" }
        ]
      })
    },
    repair: {
      always: always({
        label: "repair",
        run: ({ snapshot, handlers, signal }) => repairRound(snapshot.context, handlers, signal),
        commit: ({ result, updateContext }) => {
          updateContext((context) => ({ ...context, ...result }));
        },
        candidates: [{ to: "aggregate" }]
      })
    },
    aggregate: {
      always: always({
        label: "aggregate",
        run: ({ snapshot, handlers }) => aggregate(snapshot.context, handlers),
        commit: ({ result, updateContext }) => {
          updateContext((context) => ({
            ...context,
            answers: { ...context.answers, ...result.answers },
            trail: { ...context.trail, ...result.trail },
            open: result.short
          }));
        },
        candidates: [
          {
            to: "sample",
            label: "resample",
            when: ({ context, handlers }) => context.open.length > 0 && hasBudget(context, handlers)
          },
          { to: "abstain", label: "short", when: ({ context }) => context.open.length > 0 },
          { to: "done" }
        ]
      })
    },
    abstain: {
      always: always({
        label: "abstain",
        run: ({ snapshot, handlers }) => abstain(snapshot.context, handlers),
        commit: ({ result, updateContext }) => {
          updateContext((context) => ({
            ...context,
            answers: { ...context.answers, ...result.answers },
            trail: { ...context.trail, ...result.trail },
            open: []
          }));
        },
        candidates: [{ to: "done" }]
      })
    },
    done: {}
  }
};
