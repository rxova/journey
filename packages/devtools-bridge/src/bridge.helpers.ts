import { cloneForTransport, serializeError } from "@rxova/journey-common/serialization";
import type { NavigationResult } from "@rxova/journey-core";
import type {
  JourneyDevtoolsAttachableMachine,
  LooseMachine,
  OperationRunner
} from "./bridge.types.js";
import type {
  JourneyDevtoolsOperationResultPayload,
  JourneyDevtoolsSerializableSnapshot
} from "./protocol.types.js";

/** Creates a collision-resistant default id for a machine attached to DevTools. */
export const createJourneyMachineId = (): string =>
  `journey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export class OperationRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly maxPerWindow = 100,
    private readonly windowMs = 10_000
  ) {}

  isAllowed(): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.timestamps = this.timestamps.filter((value) => value > cutoff);
    if (this.timestamps.length >= this.maxPerWindow) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }
}

/** Clones a machine snapshot into the transport-safe DevTools snapshot shape. */
export const serializeSnapshot = (snapshot: unknown): JourneyDevtoolsSerializableSnapshot =>
  cloneForTransport(snapshot) as JourneyDevtoolsSerializableSnapshot;

/** Snapshot result payload for a lifecycle verb (`transitioned` = applied). */
const lifecycleResult = (
  machine: LooseMachine,
  applied: boolean
): JourneyDevtoolsOperationResultPayload => ({
  kind: "snapshot",
  snapshot: serializeSnapshot(machine.getSnapshot()),
  transitioned: applied
});

/** Snapshot result payload for a navigation verb / send. */
const navigationResult = (
  machine: LooseMachine,
  result: NavigationResult
): JourneyDevtoolsOperationResultPayload => ({
  kind: "snapshot",
  snapshot: serializeSnapshot(machine.getSnapshot()),
  transitioned: result.ok,
  ...(result.ok
    ? {}
    : {
        error: serializeError(
          "error" in result && result.error !== undefined
            ? result.error
            : new Error(`navigation rejected: ${result.reason}`)
        )
      })
});

const stringField = (input: Record<string, unknown> | undefined, key: string): string => {
  const value = input?.[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`journey devtools: operation input "${key}" must be a non-empty string`);
  }
  return value;
};

const optionalIntegerField = (
  input: Record<string, unknown> | undefined,
  key: string
): number | undefined => {
  const value = input?.[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`journey devtools: operation input "${key}" must be a positive integer`);
  }
  return value;
};

/** Builds the operation set the bridge registers for a machine. */
export function buildOperationRunners(
  attachable: JourneyDevtoolsAttachableMachine
): OperationRunner[] {
  const machine = attachable as unknown as LooseMachine;
  const runners: OperationRunner[] = [
    {
      descriptor: {
        id: "lifecycle.start",
        label: "start",
        description: "idle → running; enters the first/initial step.",
        mutates: true,
        output: "snapshot",
        fields: []
      },
      run: async () => lifecycleResult(machine, machine.controls.start())
    },
    {
      descriptor: {
        id: "lifecycle.pause",
        label: "pause",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      },
      run: async () => lifecycleResult(machine, machine.controls.pause())
    },
    {
      descriptor: {
        id: "lifecycle.resume",
        label: "resume",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      },
      run: async () => lifecycleResult(machine, machine.controls.resume())
    },
    {
      descriptor: {
        id: "lifecycle.complete",
        label: "complete",
        description: "Explicit completion with an optional outcome payload.",
        mutates: true,
        output: "snapshot",
        fields: [{ key: "payload", label: "Payload", type: "json" }]
      },
      run: async (input) => lifecycleResult(machine, machine.controls.complete(input?.payload))
    },
    {
      descriptor: {
        id: "lifecycle.terminate",
        label: "terminate",
        description: "Terminates from any status with an optional outcome payload.",
        mutates: true,
        output: "snapshot",
        fields: [{ key: "payload", label: "Payload", type: "json" }]
      },
      run: async (input) => lifecycleResult(machine, machine.controls.terminate(input?.payload))
    },
    {
      descriptor: {
        id: "lifecycle.restart",
        label: "restart",
        description: "completed | terminated → running; resets timeline and context.",
        mutates: true,
        output: "snapshot",
        fields: []
      },
      run: async () => lifecycleResult(machine, machine.controls.restart())
    },
    {
      descriptor: {
        id: "navigation.goToNextStep",
        label: "goToNextStep",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      },
      run: async () => navigationResult(machine, await machine.navigate.goToNextStep())
    },
    {
      descriptor: {
        id: "navigation.goToPreviousStep",
        label: "goToPreviousStep",
        description: "Timeline pointer back n entries (default 1).",
        mutates: true,
        output: "snapshot",
        fields: [{ key: "steps", label: "Steps", type: "integer" }]
      },
      run: async (input) =>
        navigationResult(
          machine,
          await machine.navigate.goToPreviousStep(optionalIntegerField(input, "steps"))
        )
    },
    {
      descriptor: {
        id: "navigation.goToStepById",
        label: "goToStepById",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: [{ key: "stepId", label: "Step id", type: "text", required: true }]
      },
      run: async (input) =>
        navigationResult(machine, await machine.navigate.goToStepById(stringField(input, "stepId")))
    },
    {
      descriptor: {
        id: "navigation.goToLastVisitedStep",
        label: "goToLastVisitedStep",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      },
      run: async () => navigationResult(machine, await machine.navigate.goToLastVisitedStep())
    },
    {
      descriptor: {
        id: "context.patch",
        label: "patch context",
        description: "Shallow-merges the given object into the journey context.",
        mutates: true,
        output: "snapshot",
        fields: [{ key: "patch", label: "Patch", type: "json", required: true }]
      },
      run: async (input) => {
        const patch = input?.patch;
        if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
          throw new Error('journey devtools: operation input "patch" must be an object');
        }
        machine.context.update((previous) => ({
          ...(previous as Record<string, unknown>),
          ...(patch as Record<string, unknown>)
        }));
        return lifecycleResult(machine, true);
      }
    },
    {
      descriptor: {
        id: "machine.inspectSnapshot",
        label: "inspect snapshot",
        description: null,
        mutates: false,
        output: "data",
        fields: []
      },
      run: async () => ({ kind: "data", data: serializeSnapshot(machine.getSnapshot()) })
    }
  ];

  if (machine.send) {
    runners.push({
      descriptor: {
        id: "events.send",
        label: "send event",
        description: "Sends a declared graph event with an optional payload.",
        mutates: true,
        output: "snapshot",
        fields: [
          { key: "type", label: "Event type", type: "text", required: true },
          { key: "payload", label: "Payload", type: "json" }
        ]
      },
      run: async (input) => {
        const send = machine.send as NonNullable<LooseMachine["send"]>;
        return navigationResult(machine, await send(stringField(input, "type"), input?.payload));
      }
    });
  }

  return runners;
}
