import React, { type ReactNode } from "react";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useThemeConfig, type NavbarLogo as NavbarLogoConfig } from "@docusaurus/theme-common";
import ThemedImage from "@theme/ThemedImage";

function NavbarBrandImage({ logo, alt }: { logo: NavbarLogoConfig; alt: string }): ReactNode {
  const lightSrc = useBaseUrl(logo.src);
  const darkSrc = useBaseUrl(logo.srcDark || logo.src);

  if (lightSrc === darkSrc) {
    return (
      <div className="navbar__logo">
        <img
          src={lightSrc}
          alt={alt}
          className={logo.className}
          height={logo.height}
          width={logo.width}
          style={logo.style}
        />
      </div>
    );
  }

  return (
    <div className="navbar__logo">
      <ThemedImage
        className={logo.className}
        sources={{ light: lightSrc, dark: darkSrc }}
        height={logo.height}
        width={logo.width}
        alt={alt}
        style={logo.style}
      />
    </div>
  );
}

export default function NavbarLogo(): ReactNode {
  const {
    siteConfig: { title }
  } = useDocusaurusContext();
  const {
    navbar: { title: navbarTitle, logo }
  } = useThemeConfig();

  const logoLink = useBaseUrl(logo?.href || "/");
  const fallbackAlt = navbarTitle ? "" : title;
  const alt = logo?.alt ?? fallbackAlt;

  return (
    <Link to={logoLink} className="navbar__brand" {...(logo?.target && { target: logo.target })}>
      {logo && <NavbarBrandImage logo={logo} alt={alt} />}
      {navbarTitle != null && <b className="navbar__title text--truncate">{navbarTitle}</b>}
    </Link>
  );
}
