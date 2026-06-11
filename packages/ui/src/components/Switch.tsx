type SwitchProps = {
  active: boolean;
  onClick: () => void;
  label?: string;
  /** Tailwind background class for the "on" track (defaults to the theme primary). */
  activeColor?: string;
};

// Single accessible toggle used across Settings, Focus Tools and the Power Manager.
export default function Switch({ active, onClick, label, activeColor = 'bg-primary' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 flex-shrink-0 ${active ? activeColor : 'bg-surface3 border border-border2'}`}
    >
      <span className={`w-4 h-4 bg-background rounded-full transition-transform duration-300 shadow-sm ${active ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}
