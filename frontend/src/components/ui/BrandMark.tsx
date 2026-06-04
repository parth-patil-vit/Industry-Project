type BrandMarkProps = {
  size?: number;
  variant?: "solid" | "glass";
};

/** BMS TMS logo mark — kanban columns on indigo or glass panel */
export default function BrandMark({ size = 28, variant = "solid" }: BrandMarkProps) {
  const iconSize = Math.round(size * 0.57);
  const boxClass = variant === "glass" ? "authBrandMark" : "brandLogo";

  return (
    <div className={boxClass} style={variant === "solid" ? { width: size, height: size } : undefined} aria-hidden>
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="5" width="5" height="14" rx="1.25" fill="#ffffff" />
        <rect x="9.5" y="8" width="5" height="11" rx="1.25" fill="#ffffff" fillOpacity="0.92" />
        <rect x="16" y="6" width="5" height="13" rx="1.25" fill="#ffffff" fillOpacity="0.85" />
      </svg>
    </div>
  );
}
