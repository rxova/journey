import React, { type ReactNode, useEffect, useMemo, useRef } from "react";
import { useThemeConfig } from "@docusaurus/theme-common";
import {
  useFilteredAndTreeifiedTOC,
  type TOCHighlightConfig
} from "@docusaurus/theme-common/internal";
import TOCItemTree from "@theme/TOCItems/Tree";
import type { Props } from "@theme/TOCItems";

function getVisibleBoundingClientRect(element: HTMLElement): DOMRect {
  const rect = element.getBoundingClientRect();
  const hasNoHeight = rect.top === rect.bottom;
  if (hasNoHeight) {
    return getVisibleBoundingClientRect(element.parentNode as HTMLElement);
  }
  return rect;
}

function getAnchors(minHeadingLevel: number, maxHeadingLevel: number): HTMLElement[] {
  const selectors: string[] = [];
  for (let i = minHeadingLevel; i <= maxHeadingLevel; i += 1) {
    selectors.push(`h${i}.anchor`);
  }
  return Array.from(document.querySelectorAll(selectors.join(",")));
}

function getLinks(linkClassName: string): HTMLAnchorElement[] {
  return Array.from(document.getElementsByClassName(linkClassName)) as HTMLAnchorElement[];
}

function getLinkAnchorValue(link: HTMLAnchorElement): string {
  return decodeURIComponent(link.href.substring(link.href.indexOf("#") + 1));
}

function getNavbarHeight(): number {
  const navbar = document.querySelector(".navbar");
  return navbar instanceof HTMLElement ? navbar.clientHeight : 0;
}

function getActiveAnchor(
  anchors: HTMLElement[],
  {
    anchorTopOffset
  }: {
    anchorTopOffset: number;
  }
): HTMLElement | null {
  if (anchors.length === 0) {
    return null;
  }

  const scrollTop = window.scrollY;
  const viewportBottom = scrollTop + window.innerHeight;
  const documentBottom = document.documentElement.scrollHeight - 2;

  // Top edge: always keep the first heading active before crossing into others.
  if (scrollTop <= anchorTopOffset + 4) {
    return anchors[0] ?? null;
  }

  // Bottom edge: force-highlight last heading when page is fully scrolled.
  if (viewportBottom >= documentBottom) {
    return anchors[anchors.length - 1] ?? null;
  }

  const nextVisibleAnchor = anchors.find((anchor) => {
    const rect = getVisibleBoundingClientRect(anchor);
    return rect.top >= anchorTopOffset;
  });

  if (!nextVisibleAnchor) {
    return anchors[anchors.length - 1] ?? null;
  }

  const nextRect = getVisibleBoundingClientRect(nextVisibleAnchor);
  const inTopHalf = nextRect.top > 0 && nextRect.bottom < window.innerHeight / 2;

  if (inTopHalf) {
    return nextVisibleAnchor;
  }

  const nextIndex = anchors.indexOf(nextVisibleAnchor);
  return anchors[nextIndex - 1] ?? nextVisibleAnchor;
}

function useTOCHighlightFixed(config: TOCHighlightConfig | undefined): void {
  const lastActiveLinkRef = useRef<HTMLAnchorElement | undefined>(undefined);
  const anchorTopOffsetRef = useRef<number>(0);
  const {
    navbar: { hideOnScroll }
  } = useThemeConfig();

  useEffect(() => {
    anchorTopOffsetRef.current = hideOnScroll ? 0 : getNavbarHeight();
  }, [hideOnScroll]);

  useEffect(() => {
    if (!config) {
      return () => {};
    }

    const { linkClassName, linkActiveClassName, minHeadingLevel, maxHeadingLevel } = config;

    const updateLinkActiveClass = (link: HTMLAnchorElement, active: boolean) => {
      if (active) {
        if (lastActiveLinkRef.current && lastActiveLinkRef.current !== link) {
          lastActiveLinkRef.current.classList.remove(linkActiveClassName);
        }
        link.classList.add(linkActiveClassName);
        lastActiveLinkRef.current = link;
      } else {
        link.classList.remove(linkActiveClassName);
      }
    };

    const updateActiveLink = () => {
      const links = getLinks(linkClassName);
      const anchors = getAnchors(minHeadingLevel, maxHeadingLevel);
      const activeAnchor = getActiveAnchor(anchors, {
        anchorTopOffset: anchorTopOffsetRef.current
      });
      const activeLink = links.find(
        (link) => activeAnchor && activeAnchor.id === getLinkAnchorValue(link)
      );

      links.forEach((link) => {
        updateLinkActiveClass(link, link === activeLink);
      });
    };

    document.addEventListener("scroll", updateActiveLink);
    window.addEventListener("resize", updateActiveLink);
    updateActiveLink();

    return () => {
      document.removeEventListener("scroll", updateActiveLink);
      window.removeEventListener("resize", updateActiveLink);
    };
  }, [config]);
}

export default function TOCItems({
  toc,
  className = "table-of-contents table-of-contents__left-border",
  linkClassName = "table-of-contents__link",
  linkActiveClassName = undefined,
  minHeadingLevel: minHeadingLevelOption,
  maxHeadingLevel: maxHeadingLevelOption,
  ...props
}: Props): ReactNode {
  const themeConfig = useThemeConfig();

  const minHeadingLevel = minHeadingLevelOption ?? themeConfig.tableOfContents.minHeadingLevel;
  const maxHeadingLevel = maxHeadingLevelOption ?? themeConfig.tableOfContents.maxHeadingLevel;

  const tocTree = useFilteredAndTreeifiedTOC({
    toc,
    minHeadingLevel,
    maxHeadingLevel
  });

  const tocHighlightConfig: TOCHighlightConfig | undefined = useMemo(() => {
    if (linkClassName && linkActiveClassName) {
      return {
        linkClassName,
        linkActiveClassName,
        minHeadingLevel,
        maxHeadingLevel
      };
    }
    return undefined;
  }, [linkClassName, linkActiveClassName, minHeadingLevel, maxHeadingLevel]);

  useTOCHighlightFixed(tocHighlightConfig);

  return (
    <TOCItemTree toc={tocTree} className={className} linkClassName={linkClassName} {...props} />
  );
}
