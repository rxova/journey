import type { JourneyDevtoolsMachineOperationDescriptor } from "@rxova/journey-devtools-bridge";

type OperationFieldProps = {
  operationId: string;
  field: JourneyDevtoolsMachineOperationDescriptor["fields"][number];
  value: string;
  disabled: boolean;
  options: readonly string[] | undefined;
  onChange: (key: string, value: string) => void;
};

export const OperationField = ({
  operationId,
  field,
  value,
  disabled,
  options,
  onChange
}: OperationFieldProps) => {
  const stateKey = `${operationId}:${field.key}`;

  if (field.type === "boolean") {
    return (
      <select
        value={value || "false"}
        onChange={(event) => onChange(stateKey, event.target.value)}
        disabled={disabled}
      >
        <option value="false">false</option>
        <option value="true">true</option>
      </select>
    );
  }

  if (options && options.length > 0) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(stateKey, event.target.value)}
        disabled={disabled}
      >
        <option value="">{field.placeholder ?? field.key}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      value={value}
      onChange={(event) => onChange(stateKey, event.target.value)}
      placeholder={field.placeholder ?? field.key}
      disabled={disabled}
    />
  );
};
