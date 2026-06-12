import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Conditional class names with Tailwind conflict resolution.
// (clsx + tailwind-merge were dependencies since Phase 4 but unused.)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
