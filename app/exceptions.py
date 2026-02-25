"""Central custom exceptions for the application."""


class StationNotFoundError(Exception):
    """Raised when a requested station is not found in the metadata."""


class DataUnavailableError(Exception):
    """Raised when required data (e.g., metadata or station files) is not available."""


class InvalidYearRangeError(Exception):
    """Raised when the provided year range is invalid."""
