export const classNames = (...values: Array<string | false | null | undefined>): string =>
  values.filter(Boolean).join(" ");
