from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    print("Navigating to http://localhost:8000/webworker.html")
    page.goto("http://localhost:8000/webworker.html")

    # Verify title
    print("Verifying title...")
    title = page.title()
    assert "Battle Royale" in title
    print(f"Title verified: {title}")

    # Start the game
    print("Clicking Play button...")
    page.click("#playPauseBtn")

    # Wait for matches to increment
    print("Waiting for match count to increase...")
    page.wait_for_function("document.getElementById('matchCount').innerText.replace(',', '') > 100")

    current_matches = page.eval_on_selector("#matchCount", "el => el.innerText")
    print(f"Match count reached: {current_matches}")

    # Wait a bit more to see some stats populate
    page.wait_for_timeout(2000)

    # Take screenshot
    print("Taking screenshot...")
    page.screenshot(path="verification/screenshot.png")

    browser.close()
    print("Verification complete.")

with sync_playwright() as playwright:
    run(playwright)
