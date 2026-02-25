from __future__ import annotations

import math

EARTH_RADIUS_KM = 6371.0088  # mittlerer Erdradius

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat_rad = math.radians(lat2 - lat1)
    delta_lon_rad = math.radians(lon2 - lon1)

    haversine_term = (
        math.sin(delta_lat_rad / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon_rad / 2) ** 2
    )
    central_angle = 2 * math.atan2(math.sqrt(haversine_term), math.sqrt(1 - haversine_term))
    return EARTH_RADIUS_KM * central_angle

def bounding_box(lat: float, lon: float, radius_km: float) -> tuple[float, float, float, float]:
    # grobe Vorfilterung: (minLat, maxLat, minLon, maxLon)
    lat_rad = math.radians(lat)
    delta_lat = radius_km / 111.32  # km pro Grad Breite

    cos_lat = max(1e-12, math.cos(lat_rad))
    delta_lon = radius_km / (111.32 * cos_lat)

    return (lat - delta_lat, lat + delta_lat, lon - delta_lon, lon + delta_lon)
