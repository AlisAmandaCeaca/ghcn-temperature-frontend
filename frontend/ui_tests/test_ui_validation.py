import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

@pytest.mark.negative
def test_year_range_validation_message(driver, frontend_url):
    driver.get(frontend_url)

    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='startYear']"))
    )

    start = driver.find_element(By.CSS_SELECTOR, "input[name='startYear']")
    end = driver.find_element(By.CSS_SELECTOR, "input[name='endYear']")

    start.clear()
    start.send_keys("2015")
    end.clear()
    end.send_keys("2010")

    # trigger validation message render
    driver.find_element(By.XPATH, "//h3[contains(., 'Search Settings')]").click()

    msg = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.XPATH, "//*[contains(., 'Start Year must be before End Year!')]"))
    )
    assert msg.is_displayed()