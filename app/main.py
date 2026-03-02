from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware  # DIESE ZEILE HAT GEFEHLT
from pathlib import Path
import logging

from app.config import settings
from app.data.http_cache import HttpCache
from app.data.noaa_metadata_files import NoaaMetadataFiles
from app.data.noaa_station_files import NoaaStationFileStore
from app.logic.station_metadata_store import StationMetadataStore
from app.logic.station_search import StationSearchService
from app.logic.temperature_series import TemperatureSeriesService

def create_app() -> FastAPI:
    app = FastAPI(title="GHCN Temperature API")

    # Logging konfigurieren
    logging.basicConfig(level=logging.WARNING)

    # CORS Middleware einrichten
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:4200"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Dienste initialisieren
    http_cache = HttpCache(timeout_sec=settings.http_timeout_sec)
    cache_dir = Path(settings.cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)

    metadata_files = NoaaMetadataFiles(
        http=http_cache,
        cache_dir=cache_dir,
        meta_ttl_seconds=settings.metadata_ttl_sec,
    )
    
    station_files = NoaaStationFileStore(
        http=http_cache,
        cache_dir=cache_dir,
        station_ttl_seconds=settings.station_ttl_sec,
        cache_limit=settings.station_cache_limit,
    )

    metadata_store = StationMetadataStore(files=metadata_files)
    station_search = StationSearchService(metadata=metadata_store)
    temperature_series = TemperatureSeriesService(
        metadata=metadata_store, 
        station_files=station_files
    )

    # Dienste im App-State speichern
    app.state.metadata_store = metadata_store
    app.state.station_search = station_search
    app.state.series_service = temperature_series

    # Router einbinden
    from app.api.routes import router
    app.include_router(router)

    @app.on_event("startup")
    def warmup_metadata() -> None:
        metadata_store.ensure_loaded()

    return app

app = create_app()