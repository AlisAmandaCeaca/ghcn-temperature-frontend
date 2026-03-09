Standard Run: (ohne backend_down-Test):

python -m pytest -q ui_tests -m "not backend_down"

backend_down-Test: (nur wenn backend aus ist ausführen.)

python -m pytest -q ui_tests -m backend_down
