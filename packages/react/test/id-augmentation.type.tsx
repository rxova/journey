import * as React from "react";
import "@rxova/journey-react";

const NoIdComponent: React.FC = () => null;

// The JSX.IntrinsicAttributes augmentation makes `id` valid on any component
// — like `key` — without the component declaring it in its own props.
export const Probe = () => <NoIdComponent id="step-id" />;
