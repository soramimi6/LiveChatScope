import Image from "next/image";
import { formatSeconds } from "@/lib/format";
import { youtubeVideoThumbnailUrl } from "@/lib/youtube-thumbnail";
import { cn } from "@/lib/utils";

type TopicBlockThumbnailProps = {
  videoId: string;
  startSec: number;
  label: string;
  className?: string;
};

export function TopicBlockThumbnail({
  videoId,
  startSec,
  label,
  className,
}: TopicBlockThumbnailProps) {
  return (
    <div
      className={cn(
        "relative aspect-video w-20 shrink-0 overflow-hidden rounded-md border bg-muted",
        className,
      )}
      title={label}
    >
      <Image
        src={youtubeVideoThumbnailUrl(videoId)}
        alt={`${label} のサムネイル`}
        fill
        className="object-cover"
        sizes="80px"
      />
      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 py-px text-[10px] font-medium tabular-nums text-white">
        {formatSeconds(startSec)}
      </span>
    </div>
  );
}
