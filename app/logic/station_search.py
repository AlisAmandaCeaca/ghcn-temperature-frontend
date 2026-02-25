from __future__ import annotations
from dataclasses import dataclass
from typing import List
from operator import attrgetter

from app.logic.geo import bounding_box, haversine_km
from app.logic.station_metadata_store import Availability, Station, StationMetadataStore


@dataclass(frozen=True)
class StationCandidate:
    stationId: str
    name: str
    lat: float
    lon: float
    distanceKm: float
    availability: Availability  


def _covers_year_range(first_year: int, last_year: int, start_year: int, end_year: int) -> bool:
    return first_year <= start_year and last_year >= end_year


class StationSearchService:
    def __init__(self, metadata: StationMetadataStore):
        self.metadata = metadata

    def find_nearby(
        self,
        lat: float,
        lon: float,
        radius_km: int,
        limit: int,
        start_year: int,
        end_year: int,
    ) -> List[StationCandidate]:
        self.metadata.ensure_loaded()

        # Bounding Box gibt Tuple (minLat, maxLat, minLon, maxLon) zurück
        min_lat, max_lat, min_lon, max_lon = bounding_box(lat, lon, radius_km)
        candidates: List[StationCandidate] = []

        for station in self.metadata.stations_by_id.values():
            is_within_lat = min_lat <= station.lat <= max_lat
            is_within_lon = min_lon <= station.lon <= max_lon
            if not is_within_lat or not is_within_lon:
                continue

            distance_km = haversine_km(lat, lon, station.lat, station.lon)
            if distance_km > radius_km:
                continue

            availability = self._get_overlap_availability(
                station_id=station.stationId,
                start_year=start_year,
                end_year=end_year,
            )
            if availability is None:
                continue

            candidates.append(
                StationCandidate(
                    stationId=station.stationId,
                    name=station.name,
                    lat=station.lat,
                    lon=station.lon,
                    distanceKm=round(distance_km, 3),
                    availability=availability,
                )
            )

        candidates.sort(key=attrgetter("distanceKm"))
        return candidates[:limit]

    def _get_overlap_availability(
        self,
        station_id: str,
        start_year: int,
        end_year: int,
    ) -> Availability | None:
        station_inventory = self.metadata.inventory_by_id.get(station_id, {})

        tmin_availability = station_inventory.get("TMIN")
        tmax_availability = station_inventory.get("TMAX")
        if tmin_availability is None or tmax_availability is None:
            return None
        if not _covers_year_range(
            tmin_availability.firstYear, tmin_availability.lastYear, start_year, end_year
        ):
            return None
        if not _covers_year_range(
            tmax_availability.firstYear, tmax_availability.lastYear, start_year, end_year
        ):
            return None

        first_year = max(tmin_availability.firstYear, tmax_availability.firstYear)
        last_year = min(tmin_availability.lastYear, tmax_availability.lastYear)
        if first_year > last_year:
            return None

        return Availability(firstYear=first_year, lastYear=last_year)