// Shimmer placeholder for loading states (pairs with the .shimmer utility).
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} aria-hidden="true" />;
}
