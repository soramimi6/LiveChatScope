import type { SuperChatTotal, TopicBlock } from "@/lib/api";

export type TopicSuperChatRank = {
  block: TopicBlock;
  totalCount: number;
  totals: SuperChatTotal[];
};

export function formatSuperChatTotals(totals: SuperChatTotal[]): string {
  if (totals.length === 0) return "—";
  return totals
    .map((t) => `${t.amount.toLocaleString()} ${t.currency}（${t.count}件）`)
    .join(" / ");
}

export function rankTopicsBySuperChat(
  blocks: TopicBlock[],
  limit = 5,
): TopicSuperChatRank[] {
  return blocks
    .map((block) => ({
      block,
      totalCount: block.super_chat_total.reduce((sum, row) => sum + row.count, 0),
      totals: block.super_chat_total,
    }))
    .filter((row) => row.totalCount > 0)
    .sort((a, b) => {
      if (b.totalCount !== a.totalCount) {
        return b.totalCount - a.totalCount;
      }
      const amountA = a.totals.reduce((sum, row) => sum + row.amount, 0);
      const amountB = b.totals.reduce((sum, row) => sum + row.amount, 0);
      return amountB - amountA;
    })
    .slice(0, limit);
}
