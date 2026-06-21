from app.api.export_names import export_download_filename


def test_json_and_csv_filenames():
    assert export_download_filename("abc123", "json") == "LiveChatScope_Result_abc123.json"
    assert export_download_filename("abc123", "csv") == "LiveChatScope_Result_abc123.csv"


def test_markdown_filenames():
    vid = "-K_aRlUGoLI"
    assert (
        export_download_filename(vid, "markdown-summary")
        == "LiveChatScope_Result_-K_aRlUGoLI_summary.md"
    )
    assert (
        export_download_filename(vid, "markdown-clips")
        == "LiveChatScope_Result_-K_aRlUGoLI_clips.md"
    )
    assert (
        export_download_filename(vid, "markdown-thanks")
        == "LiveChatScope_Result_-K_aRlUGoLI_thanks.md"
    )
