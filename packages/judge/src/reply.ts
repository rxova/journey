import { BINARY_SCALE } from "./aggregate";
import type { Question } from "./types";

const BINARY_POINTS = Object.keys(BINARY_SCALE) as (keyof typeof BINARY_SCALE)[];

/** Opaque labels a model sees in place of option keys, by position. */
const optionLabel = (position: number): string => `option_${String.fromCharCode(65 + position)}`;

/** The most options a choice question may have: one label per letter. */
export const MAX_OPTIONS = 26;

/**
 * A choice question's options as a model sees them in one sample: the option
 * order rotated by `rotation`, and each position labelled afresh. Rotating the
 * order and the labels together keeps a model's bias toward the first option,
 * or toward a label, from favouring the same option in every sample.
 */
export function presentOptions(
  options: Readonly<Record<string, string>>,
  rotation: number
): { label: string; key: string; text: string }[] {
  const keys = Object.keys(options);
  return keys.map((_, position) => {
    const key = keys[(position + rotation) % keys.length] as string;
    return { label: optionLabel(position), key, text: options[key] as string };
  });
}

/**
 * The default samples per round: the smallest multiple of the largest option
 * count that is at least 3, so each option sits in each position equally often.
 */
export function defaultSamples(questions: Readonly<Record<string, Question>>): number {
  let options = 1;
  for (const question of Object.values(questions)) {
    if (question.kind === "choice") {
      options = Math.max(options, Object.keys(question.options).length);
    }
  }
  return Math.ceil(3 / options) * options;
}

function fieldSchema(question: Question): object {
  if (question.kind === "choice") {
    const labels = Object.keys(question.options).map((_, position) => optionLabel(position));
    return { type: "string", enum: labels };
  }
  if (question.kind === "binary") return { type: "string", enum: BINARY_POINTS };
  return { type: "integer", minimum: 0, maximum: question.levels.length - 1 };
}

/** JSON Schema of one reply: one field per question asked. Labels do not depend on rotation. */
export function replySchema(
  questions: Readonly<Record<string, Question>>,
  asked: readonly string[]
) {
  const properties: Record<string, object> = {};
  for (const key of asked) {
    properties[key] = fieldSchema(questions[key] as Question);
  }
  return { type: "object", properties, required: [...asked], additionalProperties: false };
}

/** The first JSON object in a reply, fenced or bare. */
function parseObject(reply: string): Record<string, unknown> | undefined {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start === -1 || end < start) return undefined;
  try {
    // Text that starts with `{` and ends with `}` parses to an object or not at all.
    return JSON.parse(reply.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

const quoted = (values: readonly string[]) => values.map((v) => JSON.stringify(v)).join(", ");

/**
 * Reads a reply against the questions it was asked. A choice maps back from
 * its label to the option key it stood for in this rotation, a binary point to
 * its probability, a score stays a level index. Each question is read on its
 * own, so one bad field costs only that question's value.
 */
export function readReply(
  reply: string,
  questions: Readonly<Record<string, Question>>,
  asked: readonly string[],
  rotation: number
): { values: Record<string, string | number>; errors: Record<string, string> } {
  const values: Record<string, string | number> = {};
  const errors: Record<string, string> = {};
  const parsed = parseObject(reply);
  if (!parsed) {
    for (const key of asked) errors[key] = "the reply is not a JSON object";
    return { values, errors };
  }
  for (const key of asked) {
    const question = questions[key] as Question;
    const value = parsed[key];
    if (question.kind === "choice") {
      const shown = presentOptions(question.options, rotation);
      const match = shown.find((option) => option.label === value);
      if (match) values[key] = match.key;
      else errors[key] = `expected one of ${quoted(shown.map((o) => o.label))}`;
    } else if (question.kind === "binary") {
      // A list lookup, not `in`: `in` would also accept "toString".
      const point = BINARY_POINTS.find((p) => p === value);
      if (point) values[key] = BINARY_SCALE[point];
      else errors[key] = `expected one of ${quoted(BINARY_POINTS)}`;
    } else if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < question.levels.length
    ) {
      values[key] = value;
    } else {
      errors[key] = `expected an integer from 0 to ${String(question.levels.length - 1)}`;
    }
  }
  return { values, errors };
}
