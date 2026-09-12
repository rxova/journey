import React from "react";

/**
 * `useLayoutEffect` on the client, `useEffect` on the server — keeps pre-paint
 * timing in the browser without React's SSR warning. Internal; every hook that
 * subscribes or owns a machine shares this one definition.
 */
export const useSafeLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;
