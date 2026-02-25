import asyncio
from typing import Any, Callable

from fastapi import HTTPException

from app.api.schemas import StationAvailability, StationResult
from app.exceptions import DataUnavailableError
from app.logic.station_search import StationCandidate


def to_station_result(candidate: StationCandidate) -> StationResult:
    station_availability = StationAvailability(
        firstYear=candidate.availability.firstYear,
        lastYear=candidate.availability.lastYear,
    )
    return StationResult(
        stationId=candidate.stationId,
        name=candidate.name,
        lat=candidate.lat,
        lon=candidate.lon,
        distanceKm=candidate.distanceKm,
        availability=station_availability,
    )


async def run_in_thread_or_raise_http_503(
    func: Callable[..., Any], *args, **kwargs
) -> Any:
    try:
        return await asyncio.to_thread(func, *args, **kwargs)
    except DataUnavailableError as e:
        raise HTTPException(status_code=503, detail=f"Service temporarily unavailable: {str(e)}")