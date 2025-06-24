import { FC } from "react";

export const BackwardsKIcon: FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 4v16h2v-6.5l1.5-1.5L16 18h2.5l-5-7 4.5-7H15.5L12 8.5V4H8z"
      transform="scale(-1,1) translate(-24,0)"
    />
  </svg>
);
