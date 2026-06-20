import sqlite3


def _merge_segments(segments: list[dict], merge_gap_sec: int) -> list[dict]:
    if not segments:
        return []
    merged = [segments[0]]
    for segment in segments[1:]:
        last = merged[-1]
        if segment["start_sec"] - last["end_sec"] <= merge_gap_sec:
            total_duration = last["duration_sec"] + segment["duration_sec"]
            weighted_avg = (
                last["avg_density"] * last["duration_sec"]
                + segment["avg_density"] * segment["duration_sec"]
            ) / total_duration
            merged[-1] = {
                "start_sec": last["start_sec"],
                "end_sec": segment["end_sec"],
                "duration_sec": segment["end_sec"] - last["start_sec"],
                "avg_density": weighted_avg,
            }
        else:
            merged.append(segment)
    return merged


def run_stage6c_low_activity(conn: sqlite3.Connection, video_id: str, params: dict) -> None:
    """Detect sustained low chat-density segments."""
    stage6c = params.get("stage6c", {})
    low_ratio = float(stage6c.get("low_activity_ratio", 0.5))
    min_duration_sec = int(stage6c.get("low_activity_min_sec", 300))
    merge_gap_sec = int(stage6c.get("low_activity_merge_gap_sec", 60))

    conn.execute("DELETE FROM low_activity_segments WHERE video_id = ?", (video_id,))

    rows = conn.execute(
        """
        SELECT bucket_start_sec, bucket_sec, count
        FROM density_buckets
        WHERE video_id = ?
        ORDER BY bucket_start_sec ASC
        """,
        (video_id,),
    ).fetchall()
    if not rows:
        return

    counts = [int(row["count"]) for row in rows]
    avg_count = sum(counts) / len(counts)
    threshold = avg_count * low_ratio

    segments: list[dict] = []
    run_start = None
    run_counts: list[int] = []
    run_bucket_sec = int(rows[0]["bucket_sec"])

    for row in rows:
        bucket_start = int(row["bucket_start_sec"])
        count = int(row["count"])
        if count < threshold:
            if run_start is None:
                run_start = bucket_start
                run_counts = [count]
            else:
                run_counts.append(count)
        elif run_start is not None:
            duration = bucket_start + run_bucket_sec - run_start
            if duration >= min_duration_sec:
                segments.append(
                    {
                        "start_sec": float(run_start),
                        "end_sec": float(bucket_start),
                        "duration_sec": float(duration),
                        "avg_density": sum(run_counts) / len(run_counts),
                    }
                )
            run_start = None
            run_counts = []

    if run_start is not None:
        last = rows[-1]
        end_sec = int(last["bucket_start_sec"]) + int(last["bucket_sec"])
        duration = end_sec - run_start
        if duration >= min_duration_sec:
            segments.append(
                {
                    "start_sec": float(run_start),
                    "end_sec": float(end_sec),
                    "duration_sec": float(duration),
                    "avg_density": sum(run_counts) / len(run_counts),
                }
            )

    for segment in _merge_segments(segments, merge_gap_sec):
        conn.execute(
            """
            INSERT INTO low_activity_segments (
                video_id, start_sec, end_sec, duration_sec, avg_density
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (
                video_id,
                segment["start_sec"],
                segment["end_sec"],
                segment["duration_sec"],
                segment["avg_density"],
            ),
        )
