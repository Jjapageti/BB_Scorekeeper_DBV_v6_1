from pathlib import Path
import subprocess, time
import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 8765
URL = f'http://127.0.0.1:{PORT}/index.html'

@pytest.fixture(scope='session', autouse=True)
def server():
    proc = subprocess.Popen(
        ['python', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(0.6)
    yield
    proc.terminate()
    proc.wait(timeout=5)


def open_page():
    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={"width": 1800, "height": 1200})
    page.goto(URL)
    return pw, browser, page


def test_dbv_2024_full_sheet_structure():
    pw, browser, page = open_page()
    try:
        assert 'Offizieller Spielberichtsbogen des Deutschen Baseball und Softball Verbandes e.V.' in page.locator('body').inner_text()
        assert page.locator('.line-score th.inning').count() == 12
        assert page.locator('.batting-slot').count() == 9
        assert page.locator('.player-line').count() == 27
        assert page.locator('.score-slot').count() == 90
        headers = page.locator('.batter-stat-head').all_inner_texts()
        assert headers == ['PA','AB','R','RBI','H','2B','3B','HR','K','BB/IBB','HP','SH','SF','SB','CS']
        assert page.locator('.pitcher-row').count() >= 4
        assert page.locator('.catcher-row').count() >= 4
    finally:
        browser.close(); pw.stop()


def test_substitution_fields_have_no_text_length_limit():
    pw, browser, page = open_page()
    try:
        name = page.locator('.player-line input[data-field="name"]').first
        pos = page.locator('.player-line input[data-field="pos1"]').first
        assert name.get_attribute('maxlength') is None
        assert pos.get_attribute('maxlength') is None
    finally:
        browser.close(); pw.stop()


def test_pa_dialog_separates_plate_appearance_from_runner_events():
    pw, browser, page = open_page()
    try:
        page.locator('.score-slot').first.click()
        assert page.locator('#entryDialog').get_attribute('open') is not None
        text = page.locator('#entryDialog').inner_text()
        assert '타석 결과' in text
        assert '이후 주루 결과' not in text
        assert '주루 표기' not in text
        assert '득점' not in text
        assert page.locator('#entryDialog input[name="finalBase"]').count() == 0
        assert page.locator('#runnerNotationInput').count() == 0
        assert page.locator('#scoredCheckbox').count() == 0
    finally:
        browser.close(); pw.stop()


def test_single_pa_draws_only_batter_reach_until_runner_event():
    pw, browser, page = open_page()
    try:
        page.locator('.score-slot').first.click()
        page.locator('#inningInput').fill('1')
        page.locator('#resultSelect').select_option('1B')
        page.locator('#saveEntryBtn').click()
        cell = page.locator('.score-slot').first
        assert '1B' in cell.inner_text()
        assert cell.locator('.edge.on').count() == 1
        assert cell.locator('.cell-runner-note').count() == 0
    finally:
        browser.close(); pw.stop()
