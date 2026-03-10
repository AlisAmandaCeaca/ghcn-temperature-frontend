import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

@pytest.mark.negative
def test_latitude_out_of_range_shows_message(driver, frontend_url):
    driver.get(frontend_url)

    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='latitude']"))
    )

    lat = driver.find_element(By.CSS_SELECTOR, "input[name='latitude']")
    lat.clear()
    lat.send_keys("999")  # außerhalb [-90, 90]

    driver.find_element(By.XPATH, "//h3[contains(., 'Search Settings')]").click()

    msg = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.XPATH, "//*[contains(., 'Out of range')]"))
    )
    assert msg.is_displayed()