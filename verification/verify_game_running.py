from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the local file
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Click Play button
        page.click("#playPauseBtn")

        # Wait for the game loop to run a bit (2 seconds)
        # With 1000 rounds/frame * 60fps * 2s = 120,000 rounds.
        # This should show significant divergence.
        page.wait_for_timeout(2000)

        # Take a screenshot
        screenshot_path = "verification/game_running.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run()
