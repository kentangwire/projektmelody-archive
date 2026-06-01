from pathlib import Path
import sys

from playwright.sync_api import sync_playwright


def main() -> None:
    out_dir = Path("artifacts")
    out_dir.mkdir(parents=True, exist_ok=True)

    url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/?v=2"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.goto(url, wait_until="networkidle")
        page.screenshot(path=str(out_dir / "home_mobile.png"), full_page=True)

        page.locator("#playLatestBtn").click()
        page.locator("#modalBg.open").wait_for(timeout=10000)
        page.wait_for_timeout(500)
        page.locator("#modalBox").screenshot(path=str(out_dir / "modal_box_mobile.png"))
        page.screenshot(path=str(out_dir / "modal_mobile.png"), full_page=True)

        browser.close()


if __name__ == "__main__":
    main()
