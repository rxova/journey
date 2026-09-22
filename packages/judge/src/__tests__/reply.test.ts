import { describe, expect, it } from "vitest";
import type { Question } from "@rxova/journey-judge";
import {
  defaultSamples,
  presentOptions,
  readReply,
  repairPrompt,
  replySchema,
  samplePrompt,
  SYSTEM_PROMPT
} from "@rxova/journey-judge/testing";

const questions = {
  pick: {
    kind: "choice",
    ask: "Which is better?",
    options: { red: "the red one", green: "the green one", blue: "the blue one" },
    fallback: "tie"
  },
  grade: { kind: "score", ask: "How good?", levels: ["bad", "fine", "great"], fallback: 1 },
  ok: { kind: "binary", ask: "Is it ok?", yes: "it is", no: "it is not", fallback: 0.5 }
} satisfies Record<string, Question>;
const asked = ["pick", "grade", "ok"];

describe("presentOptions", () => {
  it("rotates the options and relabels them by position", () => {
    expect(presentOptions(questions.pick.options, 1)).toEqual([
      { label: "option_A", key: "green", text: "the green one" },
      { label: "option_B", key: "blue", text: "the blue one" },
      { label: "option_C", key: "red", text: "the red one" }
    ]);
  });

  it("puts every option first once over a full rotation", () => {
    const firsts = [0, 1, 2].map((r) => presentOptions(questions.pick.options, r)[0]?.key);
    expect(firsts).toEqual(["red", "green", "blue"]);
  });
});

describe("defaultSamples", () => {
  it("is the smallest multiple of the widest choice that is at least 3", () => {
    expect(defaultSamples(questions)).toBe(3);
    const two = { a: { ...questions.pick, options: { x: "x", y: "y" } } };
    expect(defaultSamples(two)).toBe(4);
    const four = { a: { ...questions.pick, options: { w: "", x: "", y: "", z: "" } } };
    expect(defaultSamples(four)).toBe(4);
  });

  it("is 3 without a choice question", () => {
    expect(defaultSamples({ grade: questions.grade })).toBe(3);
  });
});

describe("replySchema", () => {
  it("asks for a label, a level or a binary point per question", () => {
    expect(replySchema(questions, asked)).toEqual({
      type: "object",
      properties: {
        pick: { type: "string", enum: ["option_A", "option_B", "option_C"] },
        grade: { type: "integer", minimum: 0, maximum: 2 },
        ok: { type: "string", enum: ["no", "lean-no", "unsure", "lean-yes", "yes"] }
      },
      required: asked,
      additionalProperties: false
    });
  });
});

describe("readReply", () => {
  it("maps a label back to the option it stood for in that rotation", () => {
    const reply = '{"pick":"option_A","grade":2,"ok":"lean-yes"}';
    expect(readReply(reply, questions, asked, 0).values).toEqual({
      pick: "red",
      grade: 2,
      ok: 0.75
    });
    expect(readReply(reply, questions, asked, 2).values.pick).toBe("blue");
  });

  it("reads the object out of an array", () => {
    expect(readReply('[{"ok":"yes"}]', questions, ["ok"], 0).values).toEqual({ ok: 1 });
  });

  it("reads an object out of a fenced reply", () => {
    const reply = 'Sure.\n```json\n{"pick":"option_B","grade":0,"ok":"no"}\n```';
    expect(readReply(reply, questions, asked, 0)).toEqual({
      values: { pick: "green", grade: 0, ok: 0 },
      errors: {}
    });
  });

  it("keeps the valid fields of a partly invalid reply", () => {
    const reply = '{"pick":"red","grade":1.5,"ok":"toString"}';
    const { values, errors } = readReply(reply, questions, asked, 0);
    expect(values).toEqual({});
    expect(errors).toEqual({
      pick: 'expected one of "option_A", "option_B", "option_C"',
      grade: "expected an integer from 0 to 2",
      ok: 'expected one of "no", "lean-no", "unsure", "lean-yes", "yes"'
    });
    expect(readReply('{"grade":3}', questions, ["grade"], 0).errors.grade).toBeDefined();
    expect(readReply('{"grade":"1"}', questions, ["grade"], 0).errors.grade).toBeDefined();
    expect(readReply('{"grade":-1}', questions, ["grade"], 0).errors.grade).toBeDefined();
  });

  it.each([
    ["no braces", "I cannot decide"],
    ["a closing brace before the opening one", "} {"],
    ["broken JSON", '{"pick": }'],
    ["two objects", '{"pick":"option_A"} {"ok":"yes"}'],
    ["an opening brace alone", '{"pick":"option_A"']
  ])("puts an error on every question for %s", (_, reply) => {
    const { values, errors } = readReply(reply, questions, ["pick", "ok"], 0);
    expect(values).toEqual({});
    expect(errors).toEqual({
      pick: "the reply is not a JSON object",
      ok: "the reply is not a JSON object"
    });
  });
});

describe("samplePrompt", () => {
  it("fences the state and lists each question as the model sees it", () => {
    const prompt = samplePrompt({ plan: "ship it" }, questions, asked, 1, 1000);
    expect(prompt).toContain('<material>\n{\n  "plan": "ship it"\n}\n</material>');
    expect(prompt).toContain('"pick": Which is better?\n  option_A: the green one');
    expect(prompt).toContain("  2: great");
    expect(prompt).toContain('  "yes" means: it is');
    expect(prompt).toContain('exactly these keys: "pick", "grade", "ok".');
    expect(prompt).not.toContain("red:");
  });

  it("cuts a long state and says how much was cut", () => {
    const prompt = samplePrompt("x".repeat(50), questions, ["ok"], 0, 10);
    expect(prompt).toContain(`\n${'"'}${"x".repeat(9)}\n… [cut: 42 more characters]\n</material>`);
  });

  it("serializes a state JSON cannot represent as null", () => {
    expect(samplePrompt(undefined, questions, ["ok"], 0, 10)).toContain(
      "<material>\nnull\n</material>"
    );
  });

  it("goes with a system prompt that marks the material untrusted", () => {
    expect(SYSTEM_PROMPT).toContain("untrusted");
  });
});

describe("repairPrompt", () => {
  it("shows the model its reply and each error", () => {
    expect(repairPrompt("P", "R", { pick: "bad", ok: "worse" })).toBe(
      [
        "P",
        "",
        "Your previous reply was:",
        "<reply>",
        "R",
        "</reply>",
        "It was invalid:",
        '- "pick": bad',
        '- "ok": worse',
        "Reply again with the corrected JSON object only."
      ].join("\n")
    );
  });
});
