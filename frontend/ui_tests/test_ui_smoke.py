import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

@pytest.mark.positive
def test_app_loads_shows_header(driver, frontend_url):
    driver.get(frontend_url)

    # Erstmal warten, bis Angular irgendwas gerendert hat (Such-Settings Überschrift ist stabil)
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//h3[contains(., 'Search Settings')]"))
    )

    # Header kann h1/h2 sein oder minimal anders -> wir suchen nach dem Text irgendwo
    header = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//*[contains(normalize-space(.), 'Weather Information Center')]"))
    )
    assert header is not None