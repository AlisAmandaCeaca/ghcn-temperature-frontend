import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environment';

export interface SearchParams {
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  limit: number;
  startYear: number;
  endYear: number;
  showYearMin: boolean;
  showYearMax: boolean;
  showSpringMin: boolean;
  showSpringMax: boolean;
  showSummerMin: boolean;
  showSummerMax: boolean;
  showAutumnMin: boolean;
  showAutumnMax: boolean;
  showWinterMin: boolean;
  showWinterMax: boolean;
  allStations: boolean;
}

export interface TemperatureSeries {
  name: string;
  data: (number | null)[];
}

export interface StationSeriesResponse {
  stationId: string;
  startYear: number;
  endYear: number;
  years: number[];
  series: TemperatureSeries[];
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getStationsFiltered(params: SearchParams): Observable<any> {
    const query = `lat=${params.latitude}&lon=${params.longitude}&radiusKm=${params.radiusKm}&limit=${params.limit}&startYear=${params.startYear}&endYear=${params.endYear}`;
    return this.http.get(`${this.baseUrl}/stations/nearby?${query}`);
  }

  // VOLLSTÄNDIG ANGEPASST: Sendet jetzt alle Filter-Parameter mit
  getStationDetails(stationId: string, params: SearchParams): Observable<StationSeriesResponse> {
    let httpParams = new HttpParams()
      .set('startYear', params.startYear.toString())
      .set('endYear', params.endYear.toString());

    // Alle Booleans dynamisch anhängen
    const filterKeys: (keyof SearchParams)[] = [
      'showYearMin',
      'showYearMax',
      'showSpringMin',
      'showSpringMax',
      'showSummerMin',
      'showSummerMax',
      'showAutumnMin',
      'showAutumnMax',
      'showWinterMin',
      'showWinterMax',
    ];

    filterKeys.forEach((key) => {
      if (params[key]) {
        httpParams = httpParams.set(key.toString(), 'true');
      }
    });

    return this.http.get<StationSeriesResponse>(`${this.baseUrl}/stations/${stationId}/series`, {
      params: httpParams,
    });
  }
}
