import React from "react";
import { LinearJourneyStep } from "./linear-journey-step";
import type { LinearJourneyStepProps } from "./linear.types";

/** A resolved step child: stable id and the element to render (already unwrapped from journey.Step). */
export type DerivedLinearJourneyStep = {
  id: string;
  element: React.ReactElement;
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
      `<Provider> children must be step elements; received ${typeof child}. ` +
        "Wrap text or other nodes inside a step component."
    );
  });
  return elements;
};

const assertUniqueId = (id: string, seen: Set<string>, where: string) => {
  if (seen.has(id)) {
    throw new Error(
      `<Provider> step ids must be unique; duplicate id "${id}" at ${where}. ` +
        "Every step child declares the id of the definition step it renders."
    );
  }
  seen.add(id);
};

/** Derives the step children (id prop or journey.Step wrapper) into an id → element list. */
export const deriveStepsFromChildren = (children: React.ReactNode): DerivedLinearJourneyStep[] => {
  const elements = flattenChildren(children);
  const seen = new Set<string>();

  return elements.map((element, position) => {
    if (element.type === LinearJourneyStep) {
      const { id, children: stepChildren } = element.props as LinearJourneyStepProps;
      if (typeof id !== "string" || id.length === 0) {
        throw new Error(`<Step> at position ${position} is missing its mandatory "id" prop.`);
      }
      assertUniqueId(id, seen, `position ${position}`);
      return {
        id,
        element: <React.Fragment>{stepChildren}</React.Fragment>
      };
    }

    const id = (element.props as { id?: unknown }).id;
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(
        `<Provider> step ${describeChild(element, position)} is missing its mandatory unique "id" prop. ` +
          'Give every step child an id (<Login id="login" />) or wrap it in <journey.Step id="...">.'
      );
    }
    assertUniqueId(id, seen, describeChild(element, position));

    // The id belongs to the journey config layer, not the component: strip it
    // before rendering so components never need (or receive) an `id` prop.
    const componentProps: Record<string, unknown> = {
      ...(element.props as Record<string, unknown>)
    };
    delete componentProps.id;
    return {
      id,
      element: React.createElement(element.type, componentProps)
    };
  });
};
