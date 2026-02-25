from __future__ import annotations

import os
import shutil
import tempfile
import time
from pathlib import Path

import httpx


class HttpCache:
    # Kleiner Dateicache für HTTP-Downloads mit TTL und atomarem Ersetzen.
    def __init__(self, *, timeout_sec: int, user_agent: str = "ghcn-temperature-api"):
        self.timeout_sec = timeout_sec
        self.user_agent = user_agent

    def fetch_to_file(self, url: str, target_path: Path, *, ttl_seconds: int | None = None) -> bool:
        # False = Cache-Treffer, True = neu heruntergeladen.

        self._ensure_parent_dir(target_path)

        if self._is_cache_hit(target_path, ttl_seconds):
            return False

        temp_dir, temp_file = self._create_temp_file(target_path)

        try:
            self._download_to_file(url, temp_file)

            self._replace_atomic(temp_file, target_path)

            return True
        finally:
            self._cleanup_temp_dir(temp_dir)

    def get_to_file(self, url: str, dest: Path, *, max_age_seconds: int | None = None) -> bool:
        return self.fetch_to_file(url, dest, ttl_seconds=max_age_seconds)

    @staticmethod
    def _ensure_parent_dir(target_path: Path) -> None:
        # Zielordner sicherstellen (z.B. /cache/meta oder /cache/stations/by_station)
        target_path.parent.mkdir(parents=True, exist_ok=True)

    def _is_cache_hit(self, target_path: Path, ttl_seconds: int | None) -> bool:
        # Ohne TTL immer neu laden.
        # Wenn keine TTL angegeben ist, soll immer neu geladen werden.
        if ttl_seconds is None:
            return False

        # Datei nicht vorhanden => Cache Miss
        if not target_path.exists():
            return False

        # Alter in Sekunden (jetzt - letzte Änderungszeit)
        age_seconds = time.time() - target_path.stat().st_mtime

        # Cache Hit, wenn Datei jünger/gleich TTL ist
        return age_seconds <= ttl_seconds

    def _download_to_file(self, url: str, out_file: Path) -> None:
        # Download als Stream, damit auch große Dateien effizient laufen.
        with httpx.Client(
            timeout=self.timeout_sec,
            headers={"User-Agent": self.user_agent},
            follow_redirects=True,
        ) as client:
            with client.stream("GET", url) as response:
                response.raise_for_status()

                # Binär schreiben
                with out_file.open("wb") as file_handle:
                    for chunk in response.iter_bytes():
                        if chunk:
                            file_handle.write(chunk)

    @staticmethod
    def _create_temp_file(target_path: Path) -> tuple[Path, Path]:
        temp_dir = Path(tempfile.mkdtemp(prefix="dl_", dir=str(target_path.parent)))
        temp_file = temp_dir / (target_path.name + ".tmp")
        return temp_dir, temp_file

    @staticmethod
    def _replace_atomic(temp_file: Path, dest: Path) -> None:
        os.replace(temp_file, dest)

    @staticmethod
    def _cleanup_temp_dir(temp_dir: Path) -> None:
        shutil.rmtree(temp_dir, ignore_errors=True)