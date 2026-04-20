import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { OperationSection } from "./commands";
import panelStyles from "../panelPrimitives.module.css";

type OperationSectionCardProps = {
  section: OperationSection;
  isOpen: boolean;
  onToggle: () => void;
  errorMessage?: string | null;
  children: ReactNode;
};

export const OperationSectionCard = ({
  section,
  isOpen,
  onToggle,
  errorMessage,
  children
}: OperationSectionCardProps) => (
  <section className={panelStyles.card}>
    <div
      className={`${panelStyles.sectionHeader} ${isOpen ? panelStyles.sectionHeaderWithContent : ""}`}
    >
      <h2 className={`${panelStyles.title} ${panelStyles.inlineTitle}`}>{section.label}</h2>
      <button
        type="button"
        className={panelStyles.iconButton}
        aria-label={isOpen ? `Collapse ${section.label}` : `Expand ${section.label}`}
        title={isOpen ? `Collapse ${section.label}` : `Expand ${section.label}`}
        onClick={onToggle}
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
    </div>
    {section.description ? <p className={panelStyles.muted}>{section.description}</p> : null}
    {isOpen ? children : null}
    {errorMessage ? <p className={panelStyles.statusWarning}>{errorMessage}</p> : null}
  </section>
);
