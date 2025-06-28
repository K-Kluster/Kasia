import { FC } from "react";
import { GifIcon as HeroGifIcon } from "@heroicons/react/24/outline";

interface GifIconProps {
  className?: string;
}

export const GifIcon: FC<GifIconProps> = ({ className = "w-5 h-5" }) => {
  return <HeroGifIcon className={className} />;
};
