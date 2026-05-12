import { brand } from "../../data/siteData";

export default function LogoMark({ compact = false }) {
  return (
    <div
      aria-label={brand.logoAlt}
      className={`logo-lockup ${compact ? "logo-lockup--compact" : ""}`.trim()}
    >
      <img
        alt={brand.logoAlt}
        className={`logo-mark ${compact ? "logo-mark--compact" : ""}`.trim()}
        src={brand.logoSrc}
      />
    </div>
  );
}
