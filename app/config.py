import os

from pydantic import BaseModel

# Standard-TTLs für den Cache (in Sekunden)
METADATA_TTL_SEC_DEFAULT: int = 7 * 24 * 3600
STATION_TTL_SEC_DEFAULT: int = 30 * 24 * 3600

# HTTP-Timeout in Sekunden
HTTP_TIMEOUT_SEC_DEFAULT: int = 60

# Standard-Verzeichnis für den Cache
CACHE_DIR_DEFAULT: str = "/cache"

class Settings(BaseModel):
    # ENV wird aus dem Container gelesen; sonst gelten Standardwerte.
    cache_dir: str = os.getenv("CACHE_DIR", CACHE_DIR_DEFAULT)

    metadata_ttl_sec: int = int(
        os.getenv(
            "METADATA_TTL_SEC",
            os.getenv("META_DATA_TTL_SEC", str(METADATA_TTL_SEC_DEFAULT)),
        )
    )
    station_ttl_sec: int = int(
        os.getenv("STATION_TTL_SEC", str(STATION_TTL_SEC_DEFAULT))
    )
    http_timeout_sec: int = int(
        os.getenv("HTTP_TIMEOUT_SEC", str(HTTP_TIMEOUT_SEC_DEFAULT))
    )

settings = Settings()
