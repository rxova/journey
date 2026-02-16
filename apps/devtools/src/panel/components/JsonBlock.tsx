import React from "react";

const replacer = (_key: string, value: unknown): unknown => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

export const JsonBlock = ({ value }: { value: unknown }) => {
  const rendered = React.useMemo(() => JSON.stringify(value, replacer, 2), [value]);
  return <pre className="json-block">{rendered}</pre>;
};

export default JsonBlock;
