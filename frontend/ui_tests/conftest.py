import os
import pytest
from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options

FRONTEND_URL_DEFAULT = "http://localhost:8080"

@pytest.fixture()
def frontend_url() -> str:
    return os.getenv("FRONTEND_URL", FRONTEND_URL_DEFAULT)

@pytest.fixture()
def driver():
    opts = Options()
    # Headless optional: aktivieren, wenn du ohne Browserfenster laufen lassen willst
    # opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1280,900")
    drv = Chrome(options=opts) # type: ignore
    drv.implicitly_wait(2)  # kleine Grundwartezeit, die großen Waits machen wir explizit
    try:
        yield drv
    finally:
        drv.quit()