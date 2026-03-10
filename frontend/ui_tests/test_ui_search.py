import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException


@pytest.mark.positive
def test_search_populates_station_dropdown(driver, frontend_url):
    driver.get(frontend_url)

    # Warten bis die Seite bereit ist (mind. ein Input vorhanden)
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='latitude']"))
    )

    # Helper: Feld setzen (clear + send_keys)
    def set_input(name: str, value: str):
        el = driver.find_element(By.CSS_SELECTOR, f"input[name='{name}']")
        el.clear()
        el.send_keys(value)

    # Berlin Parameter
    set_input("latitude", "52.5200")
    set_input("longitude", "13.4050")
    set_input("radiusKm", "25")
    set_input("limit", "5")
    set_input("startYear", "2000")
    set_input("endYear", "2010")

    # Search klicken
    driver.find_element(By.XPATH, "//button[@type='submit' and normalize-space()='Search']").click()

    wait = WebDriverWait(driver, 30)

    # Wir warten entweder auf Dropdown ODER auf eine Error-Message
    def dropdown_or_error(drv):
        # Dropdown (Select Station)
        selects = drv.find_elements(
            By.XPATH, "//label[contains(., 'Select Station')]/following::select[1]"
        )
        if selects:
            return ("select", selects[0])

        # Error-Box (roter Kasten)
        errors = drv.find_elements(
            By.XPATH, "//*[contains(@class,'border-red-500') and contains(@class,'text-red-600')]"
        )
        if errors:
            return ("error", errors[0])

        return None

    try:
        # until erwartet "truthy" -> None wäre falsy -> wir geben False zurück
        result = wait.until(lambda d: dropdown_or_error(d) or False)
    except TimeoutException:
        raise AssertionError("Weder Station-Dropdown noch Error-Message erschien innerhalb von 30s")

    kind, element = result

    # Wenn Error angezeigt wird -> Test failt mit verständlicher Meldung
    if kind == "error":
        raise AssertionError(f"Backend/Request failed, UI shows error: {element.text}")

    # Dropdown vorhanden -> sollte mehr als die Default-Option haben
    options = element.find_elements(By.TAG_NAME, "option")
    assert len(options) > 1