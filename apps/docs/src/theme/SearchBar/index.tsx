import React, {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "@docusaurus/router";
import useIsBrowser from "@docusaurus/useIsBrowser";
import { translate } from "@docusaurus/Translate";
import SearchBar from "@theme-original/SearchBar";
import styles from "./styles.module.css";

type SearchBarProps = ComponentProps<typeof SearchBar>;

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function SearchIcon(): ReactNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default function SearchBarWrapper(props: SearchBarProps): ReactNode {
  const isBrowser = useIsBrowser();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    closeModal();
  }, [closeModal, location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    const onGlobalShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTextInputTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        openModal();
      }

      if (event.key === "/") {
        event.preventDefault();
        openModal();
      }
    };

    document.addEventListener("keydown", onGlobalShortcut);
    return () => {
      document.removeEventListener("keydown", onGlobalShortcut);
    };
  }, [isOpen, openModal]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusInput = window.requestAnimationFrame(() => {
      const input = modalRef.current?.querySelector<HTMLInputElement>("input.navbar__search-input");
      input?.focus();
    });

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
    };

    document.addEventListener("keydown", onEscape);

    return () => {
      window.cancelAnimationFrame(focusInput);
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeModal, isOpen]);

  const onBackdropMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        closeModal();
      }
    },
    [closeModal]
  );

  return (
    <>
      <button
        type="button"
        className={styles.searchTrigger}
        onClick={openModal}
        aria-label={translate({
          id: "theme.SearchBar.label",
          message: "Search",
          description: "The ARIA label and placeholder for search button"
        })}
      >
        <SearchIcon />
        <span className={styles.searchTriggerLabel}>
          {translate({
            id: "theme.SearchBar.label",
            message: "Search",
            description: "The ARIA label and placeholder for search button"
          })}
        </span>
        <kbd className={styles.searchTriggerShortcut}>Ctrl/⌘K</kbd>
      </button>

      {isOpen &&
        isBrowser &&
        createPortal(
          <div className={styles.searchOverlay} onMouseDown={onBackdropMouseDown}>
            <div
              ref={modalRef}
              className={styles.searchDialog}
              role="dialog"
              aria-modal="true"
              aria-label={translate({
                id: "theme.SearchBar.label",
                message: "Search",
                description: "The ARIA label and placeholder for search button"
              })}
            >
              <div className={styles.searchPanel}>
                <div className={styles.searchPanelHeader}>
                  <p className={styles.searchPanelTitle}>
                    {translate({
                      id: "theme.SearchBar.label",
                      message: "Search",
                      description: "The ARIA label and placeholder for search button"
                    })}
                  </p>
                  <button
                    type="button"
                    className={styles.closeButton}
                    onClick={closeModal}
                    aria-label="Close search"
                  >
                    ×
                  </button>
                </div>
                <SearchBar {...props} />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
