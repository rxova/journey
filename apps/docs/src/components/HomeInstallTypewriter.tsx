import type { CSSProperties, ReactNode } from "react";
import styles from "./HomeInstallTypewriter.module.css";

type HomeInstallTypewriterProps = {
  commands: readonly string[];
  label?: string;
  prompt?: string;
  className?: string;
};

const LINE_WINDOW_MS = 4000;

const buildLineStyle = (
  command: string,
  index: number,
  cycleDurationMs: number
): CSSProperties & Record<string, string> => ({
  "--terminal-line-max": `${Math.max(command.length, 1)}ch`,
  "--terminal-line-delay": `${index * LINE_WINDOW_MS}ms`,
  "--terminal-line-duration": `${cycleDurationMs}ms`
});

export const HomeInstallTypewriter = ({
  commands,
  label = "Install Packages",
  prompt = "$",
  className = ""
}: HomeInstallTypewriterProps): ReactNode => {
  if (commands.length === 0) {
    return null;
  }

  const cycleDurationMs = commands.length * LINE_WINDOW_MS;
  const containerClassName = [
    "home-terminal w-full max-w-2xl rounded-2xl border border-ink-300/90 bg-[#0d1324] px-4 py-4 shadow-[0_20px_44px_-28px_rgba(20,35,60,0.55)] sm:px-5 dark:border-ink-600/90 dark:bg-[#090f1b]",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClassName}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300/95">
        {label}
      </p>
      <div
        className={`${styles.display} mt-2 text-sm leading-relaxed text-emerald-100 sm:text-[0.95rem]`}
        aria-label={label}
      >
        <span className={`${styles.prompt} text-emerald-400`}>{prompt} </span>
        <span className={styles.commandWindow}>
          {commands.map((command, index) => (
            <span
              key={`${index}-${command}`}
              className={styles.line}
              style={buildLineStyle(command, index, cycleDurationMs)}
            >
              {command}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
};
