/**
 * Clinic mark: an open ring around a figure raising a dumbbell, with a medical cross.
 * Drawn as inline SVG so it stays crisp at any size and inherits the surrounding colour.
 * To use a supplied image instead, drop it in `client/public/logo.png` and swap this
 * component's body for <img src="/logo.png" />.
 */
export default function Logo({
  className = '',
  color = 'currentColor',
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color} aria-label="Physio Fitness Clinic">
      {/* open ring, gap at the top right where the dumbbell breaks through */}
      <path
        d="M50 6a44 44 0 1 0 40.6 27.1l-8.3 3.5A35 35 0 1 1 50 15z"
        fillRule="evenodd"
      />
      {/* raised arm and dumbbell */}
      <path d="M58 44 76 26l6.4 6.4L64.4 50.4z" />
      <rect x="72" y="12" width="9" height="20" rx="3" transform="rotate(45 76.5 22)" />
      <rect x="83" y="23" width="9" height="20" rx="3" transform="rotate(45 87.5 33)" />
      {/* head */}
      <circle cx="45" cy="30" r="11" />
      {/* body with cape, legs striding */}
      <path d="M45 43c9 0 15 5 16 13l2 14-9 3-2-9-1 26H41l-3-18-8 16-9-5 11-22c-6 1-11 3-15 7l-3-9c6-6 14-10 22-11z" />
      {/* medical cross on the chest */}
      <path d="M44 52h7v6h6v7h-6v6h-7v-6h-6v-7h6z" fill="#fff" />
    </svg>
  );
}
