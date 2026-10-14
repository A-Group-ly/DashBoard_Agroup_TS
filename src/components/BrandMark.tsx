/**
 * The A-Group "A" with a transparent background. It takes the current text
 * colour, so it follows the light and dark themes on its own.
 */
export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="A-Group"
      className={`brand-mark ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
