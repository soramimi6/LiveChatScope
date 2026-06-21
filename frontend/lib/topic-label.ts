/** Matches backend `topic_label_separator` default. */
export const TOPIC_LABEL_SEPARATOR = " / ";

export function splitTopicLabel(label: string): string[] {
  return label
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}
