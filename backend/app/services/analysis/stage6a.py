import sqlite3


def run_stage6a_topic_transitions(conn: sqlite3.Connection, video_id: str, params: dict) -> None:
    """Persist sequential transitions between topic blocks."""
    conn.execute("DELETE FROM topic_transitions WHERE video_id = ?", (video_id,))

    blocks = conn.execute(
        """
        SELECT block_id, block_index, end_sec, label
        FROM topic_blocks
        WHERE video_id = ?
        ORDER BY block_index ASC
        """,
        (video_id,),
    ).fetchall()

    for idx in range(len(blocks) - 1):
        current = blocks[idx]
        nxt = blocks[idx + 1]
        conn.execute(
            """
            INSERT INTO topic_transitions (
                video_id,
                from_block_id,
                to_block_id,
                from_block_index,
                to_block_index,
                from_label,
                to_label,
                at_sec
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                video_id,
                current["block_id"],
                nxt["block_id"],
                current["block_index"],
                nxt["block_index"],
                current["label"],
                nxt["label"],
                float(current["end_sec"]),
            ),
        )
