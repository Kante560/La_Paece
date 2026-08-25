/**
 * "Keep showing up" — the last thing you read after closing out the day.
 *
 * It was previously the same faint grey as timestamps and disclaimers, which
 * is how you make the one encouraging line on the page invisible. It gets the
 * handwriting at full size and a swash that draws itself on, so it lands as a
 * sign-off rather than a footer.
 */
export default function SignOff({ text = "Keep showing up." }: { text?: string }) {
  return (
    <p className="pb-3 pt-1 text-center">
      <span className="signoff text-[26px] leading-none">
        {text}
        <svg
          className="signoff-swash"
          viewBox="0 0 200 22"
          height="16"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Two passes, like a pen doubling back over an underline. */}
          <path
            d="M6 12C36 5 74 4 108 7c22 2 46 6 62 2"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M14 17c34-5 78-6 118-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.45"
          />
        </svg>
      </span>
    </p>
  );
}
