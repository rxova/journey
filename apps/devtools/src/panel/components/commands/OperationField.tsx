import type { JourneyDevtoolsMachineOperationDescriptor } from "@rxova/journey-devtools-bridge";
import { classNames } from "../../utils/classNames";
import styles from "./commandControls.module.css";

type OperationFieldProps = {
  operationId: string;
  field: JourneyDevtoolsMachineOperationDescriptor["fields"][number];
  value: string;
  disabled: boolean;
  options: readonly string[] | undefined;
  selectOnly?: boolean;
  validationError?: string | null;
  onChange: (key: string, value: string) => void;
};

export const OperationField = ({
  operationId,
  field,
  value,
  disabled,
  options,
  selectOnly = false,
  validationError,
  onChange
}: OperationFieldProps) => {
  const stateKey = `${operationId}:${field.key}`;
  const placeholder = field.placeholder ?? field.key;
  const fieldControlClassName = classNames(validationError && styles.fieldControlInvalid);

  if (field.type === "boolean") {
    return (
      <label className={styles.fieldWrapper}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <select
          className={fieldControlClassName}
          value={value || "false"}
          onChange={(event) => onChange(stateKey, event.target.value)}
          disabled={disabled}
          aria-invalid={validationError ? "true" : undefined}
        >
          <option value="false">false</option>
          <option value="true">true</option>
        </select>
      </label>
    );
  }

  if (options || selectOnly) {
    return (
      <label className={styles.fieldWrapper}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <select
          className={fieldControlClassName}
          value={value}
          onChange={(event) => onChange(stateKey, event.target.value)}
          disabled={disabled || !options || options.length === 0}
          aria-invalid={validationError ? "true" : undefined}
        >
          <option value="">{placeholder}</option>
          {(options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "json") {
    return (
      <label className={styles.fieldWrapper}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <textarea
          className={classNames(styles.textareaField, fieldControlClassName)}
          value={value}
          onChange={(event) => onChange(stateKey, event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={field.key === "context" ? 8 : 5}
          spellCheck={false}
          aria-invalid={validationError ? "true" : undefined}
        />
        {validationError ? (
          <span className={styles.fieldError}>{validationError}</span>
        ) : (
          <span className={styles.fieldHint}>Enter valid JSON.</span>
        )}
      </label>
    );
  }

  return (
    <label className={styles.fieldWrapper}>
      <span className={styles.fieldLabel}>{field.label}</span>
      <input
        className={fieldControlClassName}
        value={value}
        onChange={(event) => onChange(stateKey, event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={validationError ? "true" : undefined}
      />
      {validationError ? <span className={styles.fieldError}>{validationError}</span> : null}
    </label>
  );
};
