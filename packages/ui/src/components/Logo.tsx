// Theme-aware brand mark: a faceted cube drawn in the current theme's primary
// colour (via currentColor) so it looks right in Midnight, OLED and Dracula.
export default function Logo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" className={`text-primary ${className}`} aria-hidden="true">
      <path d="M 64 8 L 112 36 L 64 64 L 16 36 Z" fill="currentColor" fillOpacity="0.9" />
      <path d="M 16 36 L 64 64 L 64 120 L 16 92 Z" fill="currentColor" fillOpacity="0.6" />
      <path d="M 112 36 L 112 92 L 64 120 L 64 64 Z" fill="currentColor" fillOpacity="0.4" />
      <path d="M 64 8 L 112 36 L 64 64 L 16 36 Z" fill="none" stroke="currentColor" strokeOpacity="0.9" strokeWidth="3" strokeLinejoin="round" />
      <path d="M 16 36 L 64 64 L 64 120 L 16 92 Z" fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="3" strokeLinejoin="round" />
      <path d="M 112 36 L 112 92 L 64 120 L 64 64 Z" fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
