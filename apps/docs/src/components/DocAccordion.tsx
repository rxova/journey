import type { ReactNode } from "react";

import styles from "./DocAccordion.module.css";

type DocAccordionProps = {
  children: ReactNode;
};

type DocAccordionItemProps = {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export default function DocAccordion({ children }: DocAccordionProps) {
  return <div className={styles.root}>{children}</div>;
}

export function DocAccordionItem({
  title,
  summary,
  defaultOpen = false,
  children
}: DocAccordionItemProps) {
  return (
    <details className={styles.item} open={defaultOpen}>
      <summary className={styles.summary}>
        <span className={styles.summaryText}>
          <span className={styles.title}>{title}</span>
          {summary ? <span className={styles.summaryCopy}>{summary}</span> : null}
        </span>
      </summary>
      <div className={styles.content}>{children}</div>
    </details>
  );
}
