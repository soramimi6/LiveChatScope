"""Canonical fixtures for chat-downloader monitoring (health checks, scheduled E2E)."""

# Indigo128/chat-downloader — must match requirements.txt pin.
CHAT_DOWNLOADER_PINNED_COMMIT = "aed69e336fed4f587d7d0dea90a0b3c4732dd776"

MONITOR_TEST_VIDEO_ID = "HFRMcvNxyH0"
MONITOR_TEST_VIDEO_URL = f"https://www.youtube.com/watch?v={MONITOR_TEST_VIDEO_ID}"

# Manual light check: fail if no message within this many seconds.
MONITOR_CHECK_TIMEOUT_SEC = 60
