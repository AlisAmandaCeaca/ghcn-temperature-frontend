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
  name?: string;
  data: (number | null)[];
  [key: string]: any;
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
    const httpParams = new HttpParams()
      .set('lat', params.latitude?.toString() || '0')
      .set('lon', params.longitude?.toString() || '0')
      .set('radiusKm', params.radiusKm.toString())
      .set('limit', params.limit.toString())
      .set('startYear', params.startYear.toString())
      .set('endYear', params.endYear.toString());

    return this.http.get(`${this.baseUrl}/stations/nearby`, { params: httpParams });
  }
  getApiMeta(): Observable<any> {
    return this.http.get(`${this.baseUrl}/meta`);
  }

  getStationDetails(stationId: string, params: SearchParams): Observable<StationSeriesResponse> {
    let httpParams = new HttpParams()
      .set('startYear', params.startYear.toString())
      .set('endYear', params.endYear.toString());

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
      if (params[key] === true) {
        httpParams = httpParams.set(key.toString(), 'true');
      }
    });

    return this.http.get<StationSeriesResponse>(`${this.baseUrl}/stations/${stationId}/series`, {
      params: httpParams,
    });
  }
}
