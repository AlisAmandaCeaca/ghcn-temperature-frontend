import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { NgxEchartsModule, NGX_ECHARTS_CONFIG } from 'ngx-echarts';
import * as echarts from 'echarts';
import { DataService, SearchParams, TemperatureSeries } from './services/data';
import { EChartsOption } from 'echarts';
import { ChangeDetectorRef } from '@angular/core';

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
  displayedColumns: string[] = [];
  loading = false;
  errorMessage: string | null = null;
  selectedStationId: string = '';
  searchClicked = false;
  metadata: any = {};

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

  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.initChart();
    this.loadApiMeta();
  }

  private initChart(): void {
    this.chartOption = {
      title: { text: 'Temperaturverlauf', left: 'center' },
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, padding: [20, 0] },
      grid: { top: 80, bottom: 80 },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value', name: '°C' },
      series: [],
    };
  }
  private loadApiMeta(): void {
    this.dataService.getApiMeta().subscribe({
      next: (res) => {
        const ui = res.ui;
        this.metadata = {
          latitude: { min: -90, max: 90 }, // Weltweit Standard
          longitude: { min: -180, max: 180 }, // Weltweit Standard
          radiusKm: { min: ui.radiusKmMin, max: ui.radiusKmMax },
          limit: { min: ui.limitMin, max: ui.limitMax },
          startYear: { min: ui.minYear, max: ui.maxYear },
          endYear: { min: ui.minYear, max: ui.maxYear },
        };
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Could not load API metadata.';
      },
    });
  }

  onSearch(): void {
    this.searchClicked = true;
    if (this.searchParams.latitude === null || this.searchParams.longitude === null) {
      this.errorMessage = 'Please enter coordinates.';
      this.stations = [];
      this.selectedStationId = '';
      this.selectedStation = null;
      this.yearlyTableData = [];
      this.initChart();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    this.dataService.getStationsFiltered(this.searchParams).subscribe({
      next: (response) => {
        this.stations = response?.results ?? [];

        if (this.stations.length === 0) {
          this.errorMessage = 'No station available.';
        }

        this.selectedStationId = '';
        this.selectedStation = null;
        this.yearlyTableData = [];
        this.initChart();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Stations could not be uploaded.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }
  onStationSelectChange(stationId: string): void {
    if (!stationId) return;
    this.selectedStationId = stationId;
    this.selectedStation = this.stations.find((s) => s.stationId === stationId);
    this.loadStationDetails(stationId);
  }

  private loadStationDetails(stationId: string): void {
    this.dataService.getStationDetails(stationId, this.searchParams).subscribe({
      next: (data: any) => {
        const years = data.years || [];
        const raw = data.series || {};
        const seriesArray: TemperatureSeries[] = [];

        ['YEAR', 'SPRING', 'SUMMER', 'AUTUMN', 'WINTER'].forEach((period) => {
          ['MIN', 'MAX'].forEach((type) => {
            const jsonKey = `${period}_T${type}`;
            const paramKey =
              `show${period.charAt(0)}${period.slice(1).toLowerCase()}${type.charAt(0)}${type.slice(1).toLowerCase()}` as keyof SearchParams;

            if (this.searchParams[paramKey] && raw[jsonKey]) {
              seriesArray.push({
                name: `${period === 'YEAR' ? 'YEAR' : period} ${type === 'MIN' ? 'Min' : 'Max'}`,
                data: raw[jsonKey],
              });
            }
          });
        });

        this.displayedColumns = ['year', ...seriesArray.map((s) => s.name!)];
        this.updateChart(seriesArray, years);
        this.yearlyTableData = this.convertSeriesToTable(seriesArray, years);

        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Stations could not be uploaded.';
      },
    });
  }
  private convertSeriesToTable(series: TemperatureSeries[], years: number[]): any[] {
    return years.map((year, i) => {
      const row: any = { year };
      series.forEach((s) => {
        const val = s.data ? s.data[i] : null;
        row[s.name!] = val !== null && val !== undefined ? val : '-';
      });
      return row;
    });
  }

  private updateChart(series: TemperatureSeries[], years: number[]): void {
    const legendData: string[] = series.map((s) => s.name).filter((name): name is string => !!name);

    this.chartOption = {
      title: {
        text: this.selectedStation ? `Station: ${this.selectedStation.name}` : 'temperature chart',
        left: 'center',
      },
      tooltip: { trigger: 'axis' },
      legend: {
        bottom: 0,
        show: true,
        data: legendData,
      },

      xAxis: {
        type: 'category',
        name: 'YEAR',
        data: years.map((y) => y.toString()),
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        name: '°C',
        axisLabel: { formatter: '{value}' },
      },
      series: series.map((s) => ({
        name: s.name ?? 'Unknown',
        type: 'line',
        smooth: true,
        connectNulls: true,
        data: s.data,
        symbol: 'circle',
        symbolSize: 6,
      })),
    };
  }
  private updateMetadataFromStations(stations: any[]): void {
    if (!stations.length) return;

    this.metadata = {
      latitude: {
        min: Math.min(...stations.map((s) => s.latitude)),
        max: Math.max(...stations.map((s) => s.latitude)),
      },
      longitude: {
        min: Math.min(...stations.map((s) => s.longitude)),
        max: Math.max(...stations.map((s) => s.longitude)),
      },
      radiusKm: { min: 1, max: 50 }, // Standard, da kein Radius im Datenfeld
      limit: { min: 1, max: stations.length },
      startYear: {
        min: Math.min(...stations.flatMap((s) => s.availableYears)),
        max: Math.max(...stations.flatMap((s) => s.availableYears)),
      },
      endYear: {
        min: Math.min(...stations.flatMap((s) => s.availableYears)),
        max: Math.max(...stations.flatMap((s) => s.availableYears)),
      },
    };
  }
  private updateMetadataFromYears(years: number[]): void {
    if (!years.length) return;

    this.metadata.startYear = { min: Math.min(...years), max: Math.max(...years) };
    this.metadata.endYear = { min: Math.min(...years), max: Math.max(...years) };
  }

  onFilterChange(): void {
    if (this.selectedStationId) {
      this.loadStationDetails(this.selectedStationId);
    }
  }

  onReset(): void {
    this.stations = [];
    this.selectedStation = null;
    this.yearlyTableData = [];
    this.errorMessage = null;
    this.initChart();
  }
}
