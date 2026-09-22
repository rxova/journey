import { analyzeStructure } from "@rxova/journey-core";
import { describe, expect, it, vi } from "vitest";
import { createJudge, isJudgeError, JudgeError } from "@rxova/journey-judge";
import type { CompletionRequest, JudgeModel, JudgeOptions, Question } from "@rxova/journey-judge";

const pick = {
  kind: "choice",
  ask: "Which colour?",
  options: { red: "the red one", green: "the green one", blue: "the blue one" },
  fallback: "tie"
} as const satisfies Question;
const grade = {
  kind: "score",
  ask: "How good?",
  levels: ["bad", "fine", "great"],
  fallback: 1
} as const satisfies Question;
const ok = {
  kind: "binary",
  ask: "Is it ok?",
  yes: "it is",
  no: "it is not",
  fallback: 0.5
} as const satisfies Question;

/** The label an option's text carries in this prompt's rotation. */
const labelOf = (prompt: string, text: string) =>
  new RegExp(`(option_[A-Z]): ${text}\\n`).exec(prompt)?.[1] ?? "missing";

type Reply = (request: CompletionRequest, call: number) => string | Promise<string>;

function model(reply: Reply, extra: Partial<JudgeModel> = {}) {
  let call = 0;
  const complete = vi.fn((request: CompletionRequest) => {
    call += 1;
    return Promise.resolve().then(() => reply(request, call));
  });
  return { id: "m", ...extra, complete };
}

const always = (fields: (prompt: string) => Record<string, unknown>) =>
  model(({ prompt }) => JSON.stringify(fields(prompt)));
const redModel = () => always((prompt) => ({ pick: labelOf(prompt, "the red one") }));

const judgeWith = (panel: JudgeModel[], options: Omit<JudgeOptions, "panel"> = {}) =>
  createJudge({ panel, ...options });

describe("the judge's graph", () => {
  const { definition } = judgeWith([redModel()]);
  const { issues, summary } = analyzeStructure(definition);

  it("always has a way to done", () => {
    expect(summary).toMatchObject({
      terminalPathExists: true,
      terminalStepIds: ["done"],
      unreachableStepCount: 0,
      shadowedTransitionCount: 0
    });
  });

  it("loops only from aggregate back to sample", () => {
    const cycles = issues.filter((issue) => issue.code === "cycle-detected");
    expect(cycles.length).toBeGreaterThan(0);
    for (const cycle of cycles) expect(cycle).toMatchObject({ from: "aggregate" });
    expect(issues.every((issue) => issue.code === "cycle-detected")).toBe(true);
  });
});

describe("ask", () => {
  it("settles by rules alone without a call", async () => {
    const panelist = redModel();
    const judgement = await judgeWith([panelist]).ask({
      state: { colour: "green" },
      questions: { pick, grade, ok },
      rules: {
        pick: [
          { id: "none", decide: () => undefined },
          { id: "colour", decide: (state) => ({ choice: state.colour as "green" }) }
        ],
        grade: [{ id: "fixed", decide: () => ({ score: 2, confidence: 0.4 }) }],
        ok: [{ id: "sure", decide: () => ({ probability: 0.9 }) }]
      }
    });
    expect(judgement.answers.pick).toEqual({
      choice: "green",
      votes: {},
      confidence: 1,
      abstained: false,
      source: "rule"
    });
    expect(judgement.answers.grade).toMatchObject({ score: 2, confidence: 0.4 });
    expect(judgement.answers.ok).toMatchObject({ probability: 0.9, source: "rule" });
    expect(judgement.calls).toBe(0);
    expect(judgement.trail.path).toEqual(["rules", "done"]);
    expect(judgement.trail.answers).toEqual({
      pick: { source: "rule", rule: "colour" },
      grade: { source: "rule", rule: "fixed" },
      ok: { source: "rule", rule: "sure" }
    });
    expect(panelist.complete).not.toHaveBeenCalled();
  });

  it("gives a skipped question its fallback", async () => {
    const judgement = await judgeWith([redModel()]).ask({
      state: null,
      questions: { pick, ok, grade },
      skip: ["ok", "grade"],
      rules: { pick: [{ id: "r", decide: (state) => (state ? undefined : { choice: "tie" }) }] }
    });
    expect(judgement.answers.ok).toEqual({
      probability: 0.5,
      confidence: 0,
      abstained: false,
      source: "skipped"
    });
    expect(judgement.answers.grade).toMatchObject({ score: 1, source: "skipped" });
    expect(judgement.trail.answers.ok).toEqual({ source: "skipped" });
  });

  it("answers from the panel, mapping each rotated label back", async () => {
    const panelist = redModel();
    const judgement = await judgeWith([panelist]).ask({ state: {}, questions: { pick } });
    expect(judgement.answers.pick).toEqual({
      choice: "red",
      votes: { red: 3 },
      confidence: 1,
      abstained: false,
      source: "panel"
    });
    expect(judgement.trail.path).toEqual(["rules", "sample", "aggregate", "done"]);
    expect(judgement.trail.answers.pick).toEqual({
      source: "panel",
      samples: ["s1.1", "s1.2", "s1.3"]
    });
    expect(judgement.trail.samples.map((s) => s.rotation)).toEqual([0, 1, 2]);
    expect(judgement.calls).toBe(3);
    const labels = panelist.complete.mock.calls.map(([r]) => labelOf(r.prompt, "the red one"));
    expect(labels).toEqual(["option_A", "option_C", "option_B"]);
  });

  it("cancels a model's bias toward the first label into a tie", async () => {
    const judgement = await judgeWith([always(() => ({ pick: "option_A" }))]).ask({
      state: {},
      questions: { pick }
    });
    expect(judgement.answers.pick).toMatchObject({
      choice: "tie",
      votes: { red: 1, green: 1, blue: 1 }
    });
  });

  it("passes the prompt, schema, temperature and a signal to each call", async () => {
    const panelist = always(() => ({ ok: "yes" }));
    await judgeWith([panelist], { temperature: 0.2, samples: 1 }).ask({
      state: { a: 1 },
      questions: { ok }
    });
    const [request] = panelist.complete.mock.calls[0] ?? [];
    expect(request).toMatchObject({
      temperature: 0.2,
      schema: { required: ["ok"] },
      system: expect.stringContaining("untrusted") as unknown
    });
    expect(request?.prompt).toContain('"a": 1');
    expect(request?.signal).toBeInstanceOf(AbortSignal);
  });

  it("combines scores and binaries", async () => {
    const answers = [
      { grade: 2, ok: "yes" },
      { grade: 2, ok: "lean-yes" },
      { grade: 0, ok: "yes" }
    ];
    const panelist = model((_, call) => JSON.stringify(answers[call - 1]));
    const judgement = await judgeWith([panelist], { concurrency: 1 }).ask({
      state: {},
      questions: { grade, ok }
    });
    expect(judgement.answers.grade).toMatchObject({ score: 2, source: "panel" });
    expect(judgement.answers.ok.probability).toBeCloseTo(11 / 12);
  });

  it("spreads samples over the panel and weighs each model's vote", async () => {
    const heavy = always((p) => ({ pick: labelOf(p, "the blue one") }));
    const light = redModel();
    const judgement = await judgeWith(
      [
        { ...heavy, id: "heavy", weight: 3 },
        { ...light, id: "light" }
      ],
      { samples: 4 }
    ).ask({ state: {}, questions: { pick } });
    expect(judgement.trail.samples.map((s) => s.model)).toEqual([
      "heavy",
      "light",
      "heavy",
      "light"
    ]);
    expect(judgement.answers.pick).toMatchObject({ choice: "blue", confidence: 0.75 });
  });

  it("repairs an invalid reply and keeps the values it already had", async () => {
    const panelist = model(({ prompt }, call) => {
      if (call === 1) return '{"pick":"red","ok":"yes"}';
      if (prompt.includes("Your previous reply")) {
        return JSON.stringify({ pick: labelOf(prompt, "the green one"), ok: "no" });
      }
      return JSON.stringify({ pick: labelOf(prompt, "the green one"), ok: "no" });
    });
    const judgement = await judgeWith([panelist], { concurrency: 1 }).ask({
      state: {},
      questions: { pick, ok }
    });
    expect(judgement.trail.path).toEqual(["rules", "sample", "repair", "aggregate", "done"]);
    const [first] = judgement.trail.samples;
    expect(first).toMatchObject({ repairs: 1, values: { ok: 1, pick: "green" }, errors: {} });
    expect(judgement.calls).toBe(4);
    expect(judgement.answers.pick.choice).toBe("green");
  });

  it("stops repairing once every reply is valid", async () => {
    const panelist = model((_, call) => (call === 1 ? "no idea" : '{"ok":"yes"}'));
    const judgement = await judgeWith([panelist], { repairAttempts: 3, concurrency: 1 }).ask({
      state: {},
      questions: { ok }
    });
    expect(judgement.calls).toBe(4);
    expect(judgement.trail.samples[0]?.repairs).toBe(1);
  });

  it("leaves a sample as it was when its repair call fails", async () => {
    const panelist = model(({ prompt }, call) => {
      if (call === 1) return "no idea";
      if (prompt.includes("Your previous reply")) throw new Error("down");
      return JSON.stringify({ ok: "yes" });
    });
    const judgement = await judgeWith([panelist], { concurrency: 1 }).ask({
      state: {},
      questions: { ok }
    });
    expect(judgement.trail.samples[0]).toMatchObject({ repairs: 1, reply: "no idea" });
    expect(judgement.answers.ok).toMatchObject({ probability: 1, source: "panel" });
  });

  it("samples again when a question falls short of the quorum", async () => {
    const panelist = model((_, call) => (call === 1 ? "no idea" : '{"ok":"no"}'));
    const judgement = await judgeWith([panelist], {
      quorum: 3,
      repairAttempts: 0,
      concurrency: 1
    }).ask({ state: {}, questions: { ok } });
    expect(judgement.trail.path).toEqual([
      "rules",
      "sample",
      "aggregate",
      "sample",
      "aggregate",
      "done"
    ]);
    expect(judgement.trail.answers.ok?.samples).toEqual(["s1.2", "s1.3", "s2.1", "s2.2", "s2.3"]);
    expect(judgement.answers.ok).toMatchObject({ probability: 0, confidence: 1 });
  });

  it("abstains with the fallback once maxCalls runs out, never going past it", async () => {
    const panelist = model(() => "no idea");
    const judgement = await judgeWith([panelist], { maxCalls: 7 }).ask({
      state: {},
      questions: { pick, ok }
    });
    expect(panelist.complete).toHaveBeenCalledTimes(7);
    expect(judgement.calls).toBe(7);
    expect(judgement.trail.path).toEqual([
      "rules",
      "sample",
      "repair",
      "aggregate",
      "sample",
      "aggregate",
      "abstain",
      "done"
    ]);
    expect(judgement.answers.pick).toEqual({
      choice: "tie",
      votes: {},
      confidence: 0,
      abstained: true,
      source: "abstained"
    });
    expect(judgement.trail.answers.ok).toEqual({ source: "abstained", samples: [] });
  });

  it("names in the trail the samples an abstained question did have", async () => {
    const panelist = model((_, call) => (call === 1 ? '{"ok":"yes"}' : "no idea"));
    const judgement = await judgeWith([panelist], {
      samples: 2,
      quorum: 2,
      maxCalls: 2,
      concurrency: 1
    }).ask({ state: {}, questions: { ok } });
    expect(judgement.trail.answers.ok).toEqual({ source: "abstained", samples: ["s1.1"] });
  });

  it("retries a failed call once, within maxCalls", async () => {
    const panelist = model((_, call) => {
      if (call === 1) throw new Error("flaky");
      return '{"ok":"yes"}';
    });
    const judgement = await judgeWith([panelist], { samples: 1 }).ask({
      state: {},
      questions: { ok }
    });
    expect(judgement.calls).toBe(2);
    expect(judgement.trail.samples[0]?.reply).toBe('{"ok":"yes"}');
  });

  it("does not retry into a call a first try still needs", async () => {
    const panelist = model((_, call) => {
      if (call === 1) throw new Error("flaky");
      return '{"ok":"yes"}';
    });
    const judgement = await judgeWith([panelist], {
      samples: 2,
      maxCalls: 2,
      quorum: 1,
      concurrency: 1
    }).ask({ state: {}, questions: { ok } });
    expect(panelist.complete).toHaveBeenCalledTimes(2);
    expect(judgement.trail.samples[0]).toMatchObject({
      reply: null,
      errors: { ok: "the call failed" }
    });
  });

  it("repairs only as many samples as the budget has calls left", async () => {
    const panelist = model(() => "no idea");
    const judgement = await judgeWith([panelist], { maxCalls: 4 }).ask({
      state: {},
      questions: { ok }
    });
    expect(judgement.calls).toBe(4);
    expect(judgement.trail.samples.map((s) => s.repairs)).toEqual([1, 0, 0]);
  });

  it("rejects as unreachable when every call of a round fails", async () => {
    const cause = new Error("offline");
    const panelist = model(() => {
      throw cause;
    });
    const judgement = judgeWith([panelist]).ask({ state: {}, questions: { ok } });
    await expect(judgement).rejects.toMatchObject({ code: "unreachable", cause });
    await expect(judgement).rejects.toBeInstanceOf(JudgeError);
  });

  it("times out a call that hangs", async () => {
    const hang = model(
      ({ signal }) =>
        new Promise<string>((_, reject) => {
          signal.addEventListener("abort", () => {
            reject(signal.reason as Error);
          });
        })
    );
    await expect(
      judgeWith([hang], { timeoutMs: 5, samples: 1 }).ask({ state: {}, questions: { ok } })
    ).rejects.toMatchObject({ code: "unreachable" });
    expect(hang.complete).toHaveBeenCalledTimes(2);
  });

  it("aborts calls in flight when the signal aborts", async () => {
    const controller = new AbortController();
    const seen: AbortSignal[] = [];
    const hang = model(({ signal }) => {
      seen.push(signal);
      if (seen.length === 3) controller.abort(new Error("stop"));
      return new Promise<string>((_, reject) => {
        signal.addEventListener("abort", () => {
          reject(signal.reason as Error);
        });
      });
    });
    const judgement = judgeWith([hang]).ask({
      state: {},
      questions: { ok },
      signal: controller.signal
    });
    await expect(judgement).rejects.toMatchObject({ code: "aborted" });
    expect(seen.every((signal) => signal.aborted)).toBe(true);
  });

  it("aborts during a repair", async () => {
    const controller = new AbortController();
    const panelist = model(({ prompt, signal }) => {
      if (!prompt.includes("Your previous reply")) return "no idea";
      controller.abort();
      return new Promise<string>((_, reject) => {
        signal.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    });
    await expect(
      judgeWith([panelist]).ask({ state: {}, questions: { ok }, signal: controller.signal })
    ).rejects.toMatchObject({ code: "aborted" });
  });

  it("rejects at once on a signal that already aborted", async () => {
    const panelist = redModel();
    const judgement = judgeWith([panelist]).ask({
      state: {},
      questions: { pick },
      signal: AbortSignal.abort("gone")
    });
    await expect(judgement).rejects.toMatchObject({ code: "aborted", cause: "gone" });
    expect(panelist.complete).not.toHaveBeenCalled();
  });

  it("keeps no more calls in flight than concurrency", async () => {
    let inFlight = 0;
    let most = 0;
    const panelist = model(async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return '{"ok":"yes"}';
    });
    await judgeWith([panelist], { samples: 6, concurrency: 2 }).ask({
      state: {},
      questions: { ok }
    });
    expect(most).toBe(2);
  });

  it("rethrows an error a rule throws as it is", async () => {
    const boom = new Error("boom");
    await expect(
      judgeWith([redModel()]).ask({
        state: {},
        questions: { pick },
        rules: {
          pick: [
            {
              id: "r",
              decide: () => {
                throw boom;
              }
            }
          ]
        }
      })
    ).rejects.toBe(boom);
  });

  it.each([
    ["choice", pick, { score: 1 }],
    ["score", grade, { probability: 1 }],
    ["binary", ok, { choice: "red" }]
  ])(
    "rejects a rule that answers a %s question with the wrong shape",
    async (_, question, answer) => {
      const judgement = judgeWith([redModel()]).ask({
        state: {},
        questions: { q: question as Question },
        rules: { q: [{ id: "bad", decide: () => answer as never }] }
      });
      await expect(judgement).rejects.toMatchObject({ code: "invalid" });
      await expect(judgement).rejects.toThrow(/rule "bad" on "q": a rule answered/);
    }
  );
});

describe("validation", () => {
  it.each<[string, Omit<JudgeOptions, "panel"> & { panel?: JudgeModel[] }]>([
    ["an empty panel", { panel: [] }],
    ["samples", { samples: 0 }],
    ["repairAttempts", { repairAttempts: -1 }],
    ["quorum", { quorum: 1.5 }],
    ["maxCalls", { maxCalls: 0 }],
    ["concurrency", { concurrency: 0 }],
    ["maxStateChars", { maxStateChars: 0 }],
    ["timeoutMs", { timeoutMs: 0 }],
    ["an infinite timeoutMs", { timeoutMs: Infinity }]
  ])("rejects %s", (_, options) => {
    expect(() => createJudge({ panel: [redModel()], ...options })).toThrow(JudgeError);
  });

  it.each<[string, Record<string, Question>, string[]?]>([
    ["no questions", {}],
    ["one option", { q: { ...pick, options: { a: "a" } } }],
    [
      "27 options",
      { q: { ...pick, options: Object.fromEntries([...Array(27).keys()].map((i) => [i, ""])) } }
    ],
    ["a choice fallback that is no option", { q: { ...pick, fallback: "purple" } }],
    ["one level", { q: { ...grade, levels: ["only"] } }],
    ["a score fallback past the levels", { q: { ...grade, fallback: 3 } }],
    ["a fractional score fallback", { q: { ...grade, fallback: 0.5 } }],
    ["a negative score fallback", { q: { ...grade, fallback: -1 } }],
    ["a binary fallback above 1", { q: { ...ok, fallback: 1.5 } }],
    ["a binary fallback below 0", { q: { ...ok, fallback: -0.5 } }],
    ["a skip of no question", { q: ok }, ["other"]]
  ])("rejects %s", async (_, questions, skip) => {
    const panelist = redModel();
    const judgement = createJudge({ panel: [panelist] }).ask({
      state: {},
      questions,
      ...(skip === undefined ? {} : { skip })
    });
    await expect(judgement).rejects.toMatchObject({ code: "invalid" });
    await expect(judgement).rejects.toSatisfy(isJudgeError);
    expect(panelist.complete).not.toHaveBeenCalled();
  });

  it("accepts an option key as a choice fallback", async () => {
    const judgement = await judgeWith([redModel()]).ask({
      state: {},
      questions: { pick: { ...pick, fallback: "red" } },
      skip: ["pick"]
    });
    expect(judgement.answers.pick.choice).toBe("red");
  });
});

describe("isJudgeError", () => {
  it("tells a JudgeError from any other error", () => {
    expect(isJudgeError(new JudgeError("invalid", "x"))).toBe(true);
    expect(isJudgeError(new Error("x"))).toBe(false);
    expect(isJudgeError("invalid")).toBe(false);
  });
});
