import { useEffect, useState, type ReactNode } from "react";
import Link from "@docusaurus/Link";
import styles from "./HomeFeatureCarousel.module.css";

export type HomeFeatureSlide = {
  title: string;
  body: string;
  href?: string;
};

type HomeFeatureCarouselProps = {
  title: string;
  slides: readonly HomeFeatureSlide[];
  autoAdvanceMs?: number;
  className?: string;
};

export const HomeFeatureCarousel = ({
  title,
  slides,
  autoAdvanceMs = 5000,
  className = ""
}: HomeFeatureCarouselProps): ReactNode => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [timerVersion, setTimerVersion] = useState(0);

  useEffect(() => {
    if (slides.length === 0) {
      return;
    }

    setActiveSlide((current) => Math.min(current, slides.length - 1));
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, autoAdvanceMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoAdvanceMs, slides.length, timerVersion]);

  if (slides.length === 0) {
    return null;
  }

  const resetTimer = () => {
    setTimerVersion((version) => version + 1);
  };

  const goToSlide = (index: number) => {
    setActiveSlide(index);
    resetTimer();
  };

  const goToPreviousSlide = () => {
    if (slides.length < 2) {
      return;
    }

    setActiveSlide((current) => (current - 1 + slides.length) % slides.length);
    resetTimer();
  };

  const goToNextSlide = () => {
    if (slides.length < 2) {
      return;
    }

    setActiveSlide((current) => (current + 1) % slides.length);
    resetTimer();
  };

  const currentSlide = slides[activeSlide];
  const previousSlideIndex = (activeSlide - 1 + slides.length) % slides.length;
  const nextSlideIndex = (activeSlide + 1) % slides.length;

  const visibleSlides: Array<{
    key: "previous" | "current" | "next";
    index: number;
    slide: HomeFeatureSlide;
  }> = [
    { key: "previous", index: previousSlideIndex, slide: slides[previousSlideIndex] },
    { key: "current", index: activeSlide, slide: currentSlide },
    { key: "next", index: nextSlideIndex, slide: slides[nextSlideIndex] }
  ];

  const containerClassName = ["px-1 py-1", className].filter(Boolean).join(" ");

  return (
    <div className={containerClassName}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-extrabold uppercase tracking-[0.2em] text-ink-900 md:text-lg dark:text-ink-50">
          {title}
        </p>
      </div>

      <div className={`${styles.shell} mt-4 overflow-hidden`}>
        <div
          key={activeSlide}
          className={`${styles.stage} mx-auto flex max-w-[980px] items-center justify-center gap-0`}
        >
          {visibleSlides.map(({ key, index, slide }) => {
            const isCenter = key === "current";
            const sharedClasses = `${styles.card} flex-none rounded-2xl border bg-white/95 text-left transition dark:bg-ink-900/55`;
            const centerClasses = `${styles.cardCurrent} w-[68%] md:w-[56%] border-brand-300/80 p-5 opacity-100 shadow-[0_24px_56px_-34px_rgba(20,35,60,0.45)]`;
            const sideClasses =
              "w-[68%] md:w-[56%] scale-[0.9] border-ink-200/90 p-5 opacity-65 hover:opacity-85 dark:border-ink-600/90";

            if (isCenter) {
              return (
                <div
                  key={`${slide.title}-${index}-${key}`}
                  className={`${sharedClasses} ${centerClasses}`}
                >
                  <div>
                    <p className="text-2xl font-semibold text-ink-900 dark:text-ink-50 md:text-[1.7rem]">
                      {slide.title}
                    </p>
                    <p className="mt-2 text-base leading-relaxed text-ink-700 dark:text-ink-100">
                      {slide.body}
                    </p>
                    <div className="pt-3">
                      {slide.href ? (
                        <Link
                          href={slide.href}
                          className="inline-flex text-base font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
                        >
                          Download from Chrome Web Store →
                        </Link>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="inline-flex text-base font-semibold invisible"
                        >
                          Download from Chrome Web Store →
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={`${slide.title}-${index}-${key}`}
                type="button"
                aria-label={`Show ${slide.title}`}
                onClick={() => {
                  goToSlide(index);
                }}
                className={`${sharedClasses} ${sideClasses}`}
              >
                <div className="flex h-full flex-col">
                  <p className="text-lg font-semibold text-ink-900 dark:text-ink-100 md:text-xl">
                    {slide.title}
                  </p>
                  <p className="mt-2 text-base leading-relaxed text-ink-600 dark:text-ink-200">
                    {slide.body}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          aria-label="Previous feature"
          onClick={goToPreviousSlide}
          disabled={slides.length < 2}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-ink-300 bg-white/90 text-ink-700 transition hover:-translate-y-0.5 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 hover:shadow-[0_8px_18px_-12px_rgba(20,35,60,0.55)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 dark:border-ink-500 dark:bg-ink-900/60 dark:text-ink-100 dark:hover:border-brand-300 dark:hover:bg-brand-300/20 dark:hover:text-brand-200"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next feature"
          onClick={goToNextSlide}
          disabled={slides.length < 2}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-ink-300 bg-white/90 text-ink-700 transition hover:-translate-y-0.5 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 hover:shadow-[0_8px_18px_-12px_rgba(20,35,60,0.55)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 dark:border-ink-500 dark:bg-ink-900/60 dark:text-ink-100 dark:hover:border-brand-300 dark:hover:bg-brand-300/20 dark:hover:text-brand-200"
        >
          ›
        </button>
      </div>

      <div className="mt-4 text-right text-xs font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-300">
        {activeSlide + 1} / {slides.length}
      </div>
    </div>
  );
};
