import type { JourneyDevtoolsMachineOperationDescriptor } from "@rxova/journey-devtools-bridge";
import { classNames } from "../../utils/classNames";
import { OperationField } from "./OperationField";
import styles from "./commandControls.module.css";

type OperationFormProps = {
  operation: JourneyDevtoolsMachineOperationDescriptor;
  sectionId: string;
  fieldsDisabled: boolean;
  submitDisabled: boolean;
  fieldValues: Record<string, string>;
  fieldOptions: Partial<Record<string, readonly string[]>> | undefined;
  className: string | undefined;
  buttonClassName: string | undefined;
  onFieldChange: (key: string, value: string) => void;
  onSubmit: (operation: JourneyDevtoolsMachineOperationDescriptor, sectionId: string) => void;
};

export const OperationForm = ({
  operation,
  sectionId,
  fieldsDisabled,
  submitDisabled,
  fieldValues,
  fieldOptions,
  className,
  buttonClassName,
  onFieldChange,
  onSubmit
}: OperationFormProps) => {
  const buttonLabel = operation.id === "core.resetJourney" ? "restartJourney" : operation.label;

  return (
    <div className={classNames(styles.operationForm, className)}>
      <div className={styles.fieldStack}>
        {operation.fields.map((field) => (
          <OperationField
            key={`${operation.id}:${field.key}`}
            operationId={operation.id}
            field={field}
            value={fieldValues[`${operation.id}:${field.key}`] ?? ""}
            disabled={fieldsDisabled}
            options={fieldOptions?.[field.key]}
            onChange={onFieldChange}
          />
        ))}
      </div>
      <button
        type="button"
        className={classNames(styles.actionButton, buttonClassName)}
        disabled={submitDisabled}
        onClick={() => onSubmit(operation, sectionId)}
      >
        {buttonLabel}
      </button>
    </div>
  );
};
