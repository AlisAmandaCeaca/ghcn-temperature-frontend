"""Zentrale anwendungsspezifische Exceptions."""


class StationNotFoundError(Exception):
    """Wird ausgelöst, wenn eine angefragte Station in den Metadaten fehlt."""


class DataUnavailableError(Exception):
    """Wird ausgelöst, wenn benötigte Daten (z. B. Metadaten oder Stationsdateien) fehlen."""


class InvalidYearRangeError(Exception):
    """Wird ausgelöst, wenn der angegebene Jahresbereich ungültig ist."""
