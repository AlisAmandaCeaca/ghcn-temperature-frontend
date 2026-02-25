from __future__ import annotations

from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from app.logic.metadata_store import MetadataStore
from app.data.noaa_station_files import NoaaStationFiles
from app.logic.constants import ELEMENTS, PERIODS
from app.logic.exceptions import StationNotFoundError

# by_station has no header:
# 0 ID, 1 DATE(YYYYMMDD), 2 ELEMENT, 3 DATA_VALUE, 4 MFLAG, 5 QFLAG, 6 SFLAG, 7 OBS_TIME
DAILY_DATA_COLUMNS = ["ID", "DATE", "ELEMENT", "VALUE", "MFLAG", "QFLAG", "SFLAG", "OBS_TIME"]

DailyDfLoader = Callable[[Path, str, bool, int, int], pd.DataFrame]


class TemperatureSeriesService:
    def __init__(
        self,
        metadata: MetadataStore,
        station_files: NoaaStationFiles,
        daily_df_loader: DailyDfLoader | None = None,
    ):
        self.metadata = metadata
        self.station_files = station_files
        self._daily_df_loader = daily_df_loader or _load_daily_df

    def compute_temperature_series(
        self,
        station_id: str,
        start_year: int,
        end_year: int,
        ignore_qflag: bool = True,
    ) -> Tuple[List[int], Dict[str, List[Optional[float]]]]:
        self.metadata.ensure_loaded()
        if station_id not in self.metadata.stations_by_id:
            raise StationNotFoundError(f"Station '{station_id}' not found")

        years, series = self._initialize_series(start_year, end_year)
        station = self.metadata.stations_by_id[station_id]
        is_southern = float(station.lat) < 0

        station_path = self.station_files.ensure_station_gz(station_id)
        period_df = self._load_and_filter_data(
            station_path,
            station_id,
            ignore_qflag,
            start_year,
            end_year,
            is_southern,
        )
        
        if period_df.empty:
            return years, series

        aggregated_df = self._aggregate_data(period_df)
        self._fill_series(series, years, aggregated_df)
        return years, series

    def _initialize_series(self, start_year: int, end_year: int) -> Tuple[List[int], Dict[str, List[Optional[float]]]]:
        years = list(range(start_year, end_year + 1))
        series = _empty_series(years)
        return years, series

    def _load_and_filter_data(self, station_path: Path, station_id: str, ignore_qflag: bool, start_year: int, end_year: int, is_southern: bool) -> pd.DataFrame:
        daily_df = self._daily_df_loader(
            gz_path=station_path,
            station_id=station_id,
            ignore_qflag=ignore_qflag,
            start_year=start_year,
            end_year=end_year,
        )
        if daily_df.empty:
            return daily_df

        daily_df = _add_time_cols(daily_df)
        period_df = _add_period_views(daily_df, is_southern)
        return self._filter_period_years(period_df, start_year, end_year)

    @staticmethod
    def _filter_period_years(period_df: pd.DataFrame, start_year: int, end_year: int) -> pd.DataFrame:
        return period_df[(period_df["periodYear"] >= start_year) & (period_df["periodYear"] <= end_year)]

    def _aggregate_data(self, period_df: pd.DataFrame) -> pd.DataFrame:
        aggregated_df = (
            period_df.groupby(["periodYear", "period", "ELEMENT"])["valueC"]
            .mean()
            .unstack("ELEMENT")
            .reset_index()
        )
        return aggregated_df

    def _fill_series(self, series: Dict[str, List[Optional[float]]], years: List[int], aggregated_df: pd.DataFrame) -> None:
        _fill_series(series, years, aggregated_df)


def _load_daily_df(
    gz_path: Path,
    station_id: str,
    ignore_qflag: bool,
    start_year: int,
    end_year: int,
) -> pd.DataFrame:
    """
    Lädt by_station .csv.gz chunked und filtert so früh wie möglich:
    - Datum (start_year..end_year+1 Feb) -> nötig für Winter-Logik (Dez + Jan/Feb Folgejahr)
    - ID == station_id (robust, auch wenn Datei mal nicht strikt 1 Station wäre)
    - ELEMENT in {TMIN, TMAX}
    - VALUE != -9999
    - optional QFLAG leer
    """
    start_date = f"{start_year}0101"
    # NEU: Jan/Feb des Folgejahrs mit einlesen, damit Winter(end_year) = Dez(end_year) + Jan/Feb(end_year+1)
    end_date = f"{end_year + 1}0229"

    filtered_chunks: List[pd.DataFrame] = []

    for chunk_df in _iter_daily_chunks(gz_path):
        filtered_chunk_df = _filter_daily_chunk(
            chunk_df=chunk_df,
            station_id=station_id,
            start_date=start_date,
            end_date=end_date,
            ignore_qflag=ignore_qflag,
        )
        if filtered_chunk_df.empty:
            continue
        filtered_chunks.append(filtered_chunk_df)

    return _build_daily_value_df(filtered_chunks)


def _iter_daily_chunks(gz_path: Path):
    return pd.read_csv(
        gz_path,
        compression="gzip",
        header=None,
        names=DAILY_DATA_COLUMNS,
        usecols=["ID", "DATE", "ELEMENT", "VALUE", "QFLAG"],
        dtype={
            "ID": "string",
            "DATE": "string",
            "ELEMENT": "string",
            "VALUE": "int32",
            "QFLAG": "string",
        },
        low_memory=True,
        chunksize=1_000_000,
    )


def _filter_daily_chunk(
    chunk_df: pd.DataFrame,
    station_id: str,
    start_date: str,
    end_date: str,
    ignore_qflag: bool,
) -> pd.DataFrame:
    filtered_df = chunk_df[(chunk_df["DATE"] >= start_date) & (chunk_df["DATE"] <= end_date)]
    if filtered_df.empty:
        return filtered_df

    filtered_df = filtered_df[filtered_df["ID"] == station_id]
    if filtered_df.empty:
        return filtered_df

    filtered_df = filtered_df[filtered_df["ELEMENT"].isin(ELEMENTS)]
    if filtered_df.empty:
        return filtered_df

    filtered_df = filtered_df[filtered_df["VALUE"] != -9999]
    if filtered_df.empty:
        return filtered_df

    if ignore_qflag:
        filtered_df = filtered_df[filtered_df["QFLAG"].fillna("") == ""]

    return filtered_df


def _build_daily_value_df(filtered_chunks: List[pd.DataFrame]) -> pd.DataFrame:
    if not filtered_chunks:
        return pd.DataFrame(columns=["DATE", "ELEMENT", "valueC"])

    daily_df = pd.concat(filtered_chunks, ignore_index=True)
    daily_df["valueC"] = daily_df["VALUE"] / 10.0
    return daily_df[["DATE", "ELEMENT", "valueC"]]


def _add_time_cols(daily_df: pd.DataFrame) -> pd.DataFrame:
    daily_df["year"] = daily_df["DATE"].str.slice(0, 4).astype("int32")
    daily_df["month"] = daily_df["DATE"].str.slice(4, 6).astype("int8")
    return daily_df


def _add_period_views(daily_df: pd.DataFrame, is_southern: bool) -> pd.DataFrame:
    """
    Baut 2 Views:
    - YEAR: period="YEAR", periodYear=year
    - SEASON: meteorologische Jahreszeiten
      NEU: Winter/Sommer wird dem Dezember-Jahr zugeordnet:
           Beispiel Nord: Winter 2025 = Dez 2025 + Jan/Feb 2026
           => Jan/Feb der boundary-season zählen ins Vorjahr
    """
    # YEAR view
    year_view = daily_df.copy()
    year_view["period"] = "YEAR"
    year_view["periodYear"] = year_view["year"]

    # SEASON view (vektorisiert)
    season_view = daily_df.copy()
    month_series = season_view["month"]

    season_labels = _build_northern_season_labels(month_series)

    if is_southern:
        season_labels = _map_southern_hemisphere_seasons(season_labels)
        boundary_season = "SUMMER"  # südliche Hemisphäre: Sommer ist Dec-Feb
    else:
        boundary_season = "WINTER"  # nördliche Hemisphäre: Winter ist Dec-Feb

    season_view["period"] = season_labels

    # NEU: Jan/Feb der boundary-season zählen ins Vorjahr (statt Dez ins Folgejahr)
    period_years = _compute_period_years_for_boundary_season(season_view, boundary_season)
    season_view["periodYear"] = period_years

    combined_df = pd.concat(
        [
            year_view[["periodYear", "period", "ELEMENT", "valueC"]],
            season_view[["periodYear", "period", "ELEMENT", "valueC"]],
        ],
        ignore_index=True,
    )
    return combined_df


def _build_northern_season_labels(month_series: pd.Series) -> np.ndarray:
    season_labels = np.full(len(month_series), "WINTER", dtype=object)
    season_labels[(month_series >= 3) & (month_series <= 5)] = "SPRING"
    season_labels[(month_series >= 6) & (month_series <= 8)] = "SUMMER"
    season_labels[(month_series >= 9) & (month_series <= 11)] = "AUTUMN"
    return season_labels


def _map_southern_hemisphere_seasons(season_labels: np.ndarray) -> np.ndarray:
    season_map = {
        "WINTER": "SUMMER",
        "SPRING": "AUTUMN",
        "SUMMER": "WINTER",
        "AUTUMN": "SPRING",
    }
    return np.vectorize(season_map.get)(season_labels)


def _compute_period_years_for_boundary_season(
    season_df: pd.DataFrame,
    boundary_season: str,
) -> pd.Series:
    period_years = season_df["year"].copy()
    jan_feb_boundary_mask = season_df["month"].isin([1, 2]) & (season_df["period"] == boundary_season)
    period_years.loc[jan_feb_boundary_mask] = period_years.loc[jan_feb_boundary_mask] - 1
    return period_years


def _empty_series(years: List[int]) -> Dict[str, List[Optional[float]]]:
    year_count = len(years)
    series: Dict[str, List[Optional[float]]] = {}
    for period in PERIODS:
        for element in ELEMENTS:
            series[f"{period}_{element}"] = [None] * year_count
    return series


def _fill_series(series: Dict[str, List[Optional[float]]], years: List[int], aggregated_df: pd.DataFrame) -> None:
    first_year = years[0]
    year_count = len(years)

    for _, aggregated_row in aggregated_df.iterrows():
        period_year = int(aggregated_row["periodYear"])
        period = str(aggregated_row["period"])
        year_index = period_year - first_year
        if year_index < 0 or year_index >= year_count:
            continue

        _set_value(series, period, "TMIN", year_index, aggregated_row.get("TMIN"))
        _set_value(series, period, "TMAX", year_index, aggregated_row.get("TMAX"))


def _set_value(series: Dict[str, List[Optional[float]]], period: str, element: str, year_index: int, raw_celsius_value) -> None:
    series_key = f"{period}_{element}"
    series[series_key][year_index] = _round_or_none(raw_celsius_value)


def _round_or_none(value) -> Optional[float]:
    if value is None or pd.isna(value):
        return None
    return round(float(value), 1)