"""Domain and data-layer exceptions for temperature logic."""


class StationNotFoundError(Exception):
    """Raised when a requested station is not found in the metadata."""


class DataUnavailableError(Exception):
    """Raised when required data (e.g., metadata or station files) is not available."""
