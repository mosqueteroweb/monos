from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the local file
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Wait for the canvas to be present
        page.wait_for_selector("#gameCanvas")

        # Wait for the game loop to run a bit (2 seconds)
        page.wait_for_timeout(2000)

        # Take a screenshot
        screenshot_path = "verification/game_screenshot.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run()
