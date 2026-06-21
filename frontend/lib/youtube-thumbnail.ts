export type YoutubeThumbnailQuality = "default" | "hqdefault" | "mqdefault";

export function youtubeVideoThumbnailUrl(
  videoId: string,
  quality: YoutubeThumbnailQuality = "hqdefault",
): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}
