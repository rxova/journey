import React from "react";
import { LinearJourneyStep } from "./linear-journey-step";
import type { LinearJourneyStepConfig, LinearJourneyStepProps } from "./linear.types";

/** A resolved linear journey step: stable id, the element to render, and its config. */
export type DerivedLinearJourneyStep = {
  id: string;
  /** The element to render (already unwrapped from LinearJourney.Step). */
  element: React.ReactElement;
  config: LinearJourneyStepConfig;
};

const describeChild = (child: React.ReactElement, position: number): string => {
  const type = child.type as { displayName?: string; name?: string } | string;
  const name =
    typeof type === "string" ? type : (type.displayName ?? type.name ?? "anonymous component");
  return `child #${position} (${name})`;
};

const flattenChildren = (children: React.ReactNode): React.ReactElement[] => {
  const elements: React.ReactElement[] = [];
  React.Children.forEach(children, (child) => {
    if (child === null || child === undefined || typeof child === "boolean") {
      return;
    }
    // (React.Children.forEach traverses nested arrays itself.)
    if (React.isValidElement(child)) {
      if (child.type === React.Fragment) {
        elements.push(...flattenChildren((child.props as { children?: React.ReactNode }).children));
        return;
      }
      elements.push(child);
      return;
    }
    throw new Error(
      `<LinearJourney> children must be step elements; received ${typeof child}. ` +
        "Wrap text or other nodes inside a step component."
    );
  });
  return elements;
};

const assertUniqueId = (id: string, seen: Set<string>, where: string) => {
  if (seen.has(id)) {
    throw new Error(
      `<LinearJourney> step ids must be unique; duplicate id "${id}" at ${where}. ` +
        "Every step declares a mandatory unique id (an `id` prop on the child or a <LinearJourney.Step id>)."
    );
  }
  seen.add(id);
};

/** Derives the step list from the children (id prop or <LinearJourney.Step> wrapper). */
export const deriveStepsFromChildren = (children: React.ReactNode): DerivedLinearJourneyStep[] => {
  const elements = flattenChildren(children);
  const seen = new Set<string>();

  return elements.map((element, position) => {
    if (element.type === LinearJourneyStep) {
      const {
        id,
        meta,
        onEnter,
        onLeave,
        children: stepChildren
      } = element.props as LinearJourneyStepProps;
      if (typeof id !== "string" || id.length === 0) {
        throw new Error(
          `<LinearJourney.Step> at position ${position} is missing its mandatory "id" prop.`
        );
      }
      assertUniqueId(id, seen, `position ${position}`);
      return {
        id,
        element: <React.Fragment>{stepChildren}</React.Fragment>,
        config: {
          ...(meta !== undefined ? { meta } : {}),
          ...(onEnter !== undefined ? { onEnter } : {}),
          ...(onLeave !== undefined ? { onLeave } : {})
        }
      };
    }

    const id = (element.props as { id?: unknown }).id;
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(
        `<LinearJourney> step ${describeChild(element, position)} is missing its mandatory unique "id" prop. ` +
          'Give every step child an id (<Login id="login" />) or wrap it in <LinearJourney.Step id="...">.'
      );
    }
    assertUniqueId(id, seen, describeChild(element, position));

    // The id belongs to the linear journey config layer, not the component: strip it
    // before rendering so components never need (or receive) an `id` prop.
    const componentProps: Record<string, unknown> = {
      ...(element.props as Record<string, unknown>)
    };
    delete componentProps.id;
    return {
      id,
      element: React.createElement(element.type, componentProps),
      config: {}
    };
  });
};
