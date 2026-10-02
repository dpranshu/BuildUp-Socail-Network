import Image from "next/image";
import { UserRound } from "lucide-react";

export function ProfileAvatar({
  src,
  alt,
  className,
  iconSize = 20,
}: {
  src: string | null;
  alt: string;
  className: string;
  iconSize?: number;
}) {
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-[#c5bfb7] ${className}`}>
      {src
        ? <Image src={src} alt={alt} width={256} height={256} unoptimized className="h-full w-full object-cover" />
        : <UserRound size={iconSize} strokeWidth={1.7} aria-hidden="true" />}
    </span>
  );
}