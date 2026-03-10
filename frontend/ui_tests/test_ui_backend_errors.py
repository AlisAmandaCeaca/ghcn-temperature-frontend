import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException


@pytest.mark.backend_down
def test_backend_down_shows_error_message(driver, frontend_url):
    driver.get(frontend_url)

    # Warten bis Inputs da sind
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='latitude']"))
    )

    # Helper: Feld setzen (clear + send_keys)
    def set_input(name: str, value: str):
        el = driver.find_element(By.CSS_SELECTOR, f"input[name='{name}']")
        el.clear()
        el.send_keys(value)

    # Wichtig: alle Pflichtfelder setzen, damit Search wirklich abschickt
    set_input("latitude", "52.5200")
    set_input("longitude", "13.4050")
    set_input("radiusKm", "25")
    set_input("limit", "5")
    set_input("startYear", "2000")
    set_input("endYear", "2010")

    # Search klicken
    driver.find_element(By.XPATH, "//button[@type='submit' and normalize-space()='Search']").click()

    # Jetzt MUSS bei Backend-down ein Error-Kasten erscheinen
    try:
        err = WebDriverWait(driver, 15).until(
            EC.visibility_of_element_located(
                (By.XPATH, "//*[contains(@class,'border-red-500') and contains(@class,'text-red-600')]")
            )
        )
    except TimeoutException:
        # Wenn du willst: hier könnte man zusätzlich checken, ob stattdessen Dropdown erschien
        raise AssertionError(
            "Kein Error-Kasten erschienen. Prüfe: Backend wirklich DOWN? "
            "Und wurde Search wirklich ausgelöst (Form valid)?"
        )

    assert err.is_displayed()
    assert err.text.strip() != ""