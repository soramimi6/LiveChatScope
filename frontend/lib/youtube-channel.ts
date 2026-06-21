export function youtubeChannelUrl(authorId: string): string | null {
  if (authorId.startsWith("UC") && !authorId.startsWith("unknown:")) {
    return `https://www.youtube.com/channel/${authorId}`;
  }
  return null;
}
