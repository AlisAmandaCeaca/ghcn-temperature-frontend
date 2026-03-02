import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { NgxEchartsModule, NGX_ECHARTS_CONFIG } from 'ngx-echarts';
import * as echarts from 'echarts';
import {
  DataService,
  SearchParams,
  TemperatureSeries,
  StationSeriesResponse,
} from './services/data';
import { EChartsOption } from 'echarts';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, NgxEchartsModule],
  providers: [{ provide: NGX_ECHARTS_CONFIG, useValue: { echarts } }],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  stations: any[] = [];
  selectedStation: any = null;
  yearlyTableData: any[] = [];
  loading = false;
  errorMessage: string | null = null;

  chartOption: EChartsOption = {};

  searchParams: SearchParams = {
    latitude: null,
    longitude: null,
    radiusKm: 50,
    limit: 5,
    startYear: 1950,
    endYear: 2025,
    showYearMin: true,
    showYearMax: true,
    showSpringMin: false,
    showSpringMax: false,
    showSummerMin: false,
    showSummerMax: false,
    showAutumnMin: false,
    showAutumnMax: false,
    showWinterMin: false,
    showWinterMax: false,
    allStations: false,
  };

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.initChart();
  }

  private initChart(): void {
    this.chartOption = {
      title: { text: 'Temperaturverlauf' },
      tooltip: { trigger: 'axis' },
      legend: { data: [] },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value', name: '°C' },
      series: [],
    };
  }

  // Stationsuche
  onSearch(): void {
    if (this.searchParams.latitude === null || this.searchParams.longitude === null) {
      this.errorMessage = 'Bitte Koordinaten eingeben.';
      return;
    }

    this.loading = true;
    this.errorMessage = null;
    this.selectedStation = null;
    this.yearlyTableData = [];
    this.stations = [];

    this.dataService.getStationsFiltered(this.searchParams).subscribe({
      next: (response) => {
        const results = response?.results ?? [];
        if (results.length === 0) {
          this.errorMessage = 'Keine Station im gewählten Radius gefunden.';
          this.loading = false;
          return;
        }

        this.stations = results;
        // Direkt erste Station auswählen
        this.selectedStation = results[0];
        this.loadStationDetails(this.selectedStation.stationId);
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = 'Fehler beim Laden der Stationen.';
        this.loading = false;
      },
    });
  }

  // Station auswählen
  selectStation(station: any): void {
    this.selectedStation = station;
    this.loadStationDetails(station.stationId);
  }

  private loadStationDetails(stationId: string): void {
    this.loading = true;
    this.errorMessage = null;

    this.dataService.getStationDetails(stationId, this.searchParams).subscribe({
      next: (data) => {
        console.log('API Response:', data);

        if (!data.series || data.series.length === 0) {
          this.errorMessage = 'Keine Daten für die gewählten Filter gefunden.';
          this.yearlyTableData = [];
          this.chartOption = {};
          this.loading = false;
          return;
        }

        this.yearlyTableData = this.convertSeriesToTable(data.series, data.years);
        this.updateChart(data.series, data.years);
        this.loading = false;
      },
      error: (err) => {
        console.error('API Error:', err);
        this.errorMessage = 'Fehler beim Laden der Stationendaten.';
        this.loading = false;
      },
    });
  }

  // Hilfsfunktion
  private convertSeriesToTable(series: TemperatureSeries[], years: number[]): any[] {
    const seriesArray = Array.isArray(series) ? series : [series];

    return years.map((year, i) => {
      const row: any = { year };
      seriesArray.forEach((s) => {
        if (s && s.data) {
          row[s.name] = s.data[i] !== undefined ? s.data[i] : null;
        }
      });
      return row;
    });
  }

  // Chart
  private updateChart(series: TemperatureSeries[], years: number[]): void {
    const seriesArray = Array.isArray(series) ? series : [series];

    this.chartOption = {
      title: { text: 'Temperaturverlauf' },
      tooltip: { trigger: 'axis' },
      legend: { data: seriesArray.map((s) => s.name) },
      xAxis: { type: 'category', data: years },
      yAxis: { type: 'value', name: '°C' },
      series: seriesArray.map((s) => ({
        name: s.name,
        type: 'line',
        smooth: true,
        data: s.data,
      })),
    };
  }

  onFilterChange(): void {
    if (this.selectedStation) {
      this.loadStationDetails(this.selectedStation.stationId);
    }
  }

  // Zurücksetzten
  onReset(): void {
    this.stations = [];
    this.selectedStation = null;
    this.yearlyTableData = [];
    this.errorMessage = null;
    this.initChart();
  }
}
