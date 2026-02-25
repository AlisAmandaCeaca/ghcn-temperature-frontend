from fastapi import HTTPException
from datetime import date
import asyncio

from app.api.validation import validate_year_range
from app.exceptions.validation import InvalidYearRangeError


async def _validate_years(request, start_year: int, end_year: int) -> None:
    metadata_store = request.app.state.metadata_store
    min_year = metadata_store.ui_min_year()
    max_year = date.today().year - 1
    try:
        await asyncio.to_thread(
            validate_year_range, start_year, end_year, min_year=min_year, max_year=max_year
        )
    except InvalidYearRangeError as e:
        raise HTTPException(status_code=400, detail=str(e))