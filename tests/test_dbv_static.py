from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]


def soup():
    return BeautifulSoup((ROOT / 'index.html').read_text(encoding='utf-8'), 'html.parser')


def test_full_dbv_sections_exist():
    s = soup()
    assert s.select_one('.dbv-title').get_text(strip=True).startswith('Offizieller Spielberichtsbogen')
    assert len(s.select('.line-score th.inning')) == 12
    assert s.select_one('#mainScoreTable') is not None
    assert s.select_one('#pitcherTable') is not None
    assert s.select_one('#catcherTable') is not None
    assert s.select_one('#officialsBlock') is not None


def test_batter_and_pitcher_headers_match_sheet():
    s = soup()
    batter = [x.get_text(' ', strip=True) for x in s.select('.batter-stat-head')]
    assert batter == ['PA','AB','R','RBI','H','2B','3B','HR','K','BB/IBB','HP','SH','SF','SB','CS']
    pitcher = [x.get_text(' ', strip=True) for x in s.select('.pitcher-stat-head')]
    assert pitcher == ['BF','AB','R','ER','H','2B','3B','HR','K','BB/IBB','HP','SH','SF','WP','BK','WLS']


def test_pa_dialog_contains_only_plate_appearance_fields():
    s = soup()
    dlg = s.select_one('#entryDialog')
    text = dlg.get_text(' ', strip=True)
    assert '타석 결과' in text
    assert '이후 주루 결과' not in text
    assert '주루 표기' not in text
    assert '득점' not in text
    assert dlg.select_one('#runnerNotationInput') is None
    assert dlg.select_one('#scoredCheckbox') is None
    assert dlg.select_one('input[name="finalBase"]') is None
    assert dlg.select_one('#autoReachText') is not None
