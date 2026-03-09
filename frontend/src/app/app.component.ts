import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { NgxEchartsModule, NGX_ECHARTS_CONFIG } from 'ngx-echarts';
import { DataService, SearchParams, TemperatureSeries } from './services/data';
import { EChartsOption } from 'echarts';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';

import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
} from 'echarts/components';

import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, NgxEchartsModule],
  providers: [{ provide: NGX_ECHARTS_CONFIG, useValue: { echarts } }],
  templateUrl: './app.component.html',
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

  trackByYear(item: any) {
    return item.year;
  }

  blockDecimal(event: KeyboardEvent) {
    if (event.key === '.' || event.key === ',') {
      event.preventDefault();
    }
  }

  private initChart(): void {
    this.chartOption = {
      title: {
        text: 'Temperaturverlauf',
        left: 'center',
      },

      tooltip: {
        trigger: 'axis',
        confine: true,
      },

      legend: {
        bottom: 0,
      },

      grid: {
        top: 70,
        bottom: 80,
        left: 50,
        right: 30,
      },

      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: [],
      },

      yAxis: {
        type: 'value',
        name: '°C',
      },

      series: [],
    };
  }

  private loadApiMeta(): void {
    this.dataService.getApiMeta().subscribe({
      next: (res) => {
        const ui = res.ui;

        this.metadata = {
          latitude: { min: -90, max: 90 },
          longitude: { min: -180, max: 180 },
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
      this.resetView();
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

        const paramKeyMap: Record<string, keyof SearchParams> = {
          YEAR_TMIN: 'showYearMin',
          YEAR_TMAX: 'showYearMax',

          SPRING_TMIN: 'showSpringMin',
          SPRING_TMAX: 'showSpringMax',

          SUMMER_TMIN: 'showSummerMin',
          SUMMER_TMAX: 'showSummerMax',

          AUTUMN_TMIN: 'showAutumnMin',
          AUTUMN_TMAX: 'showAutumnMax',

          WINTER_TMIN: 'showWinterMin',
          WINTER_TMAX: 'showWinterMax',
        };

        Object.entries(paramKeyMap).forEach(([jsonKey, paramKey]) => {
          if (this.searchParams[paramKey] && raw[jsonKey]) {
            const [period, type] = jsonKey.split('_T');

            seriesArray.push({
              name: `${period} ${type === 'MIN' ? 'Min' : 'Max'}`,
              data: raw[jsonKey],
            });
          }
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

        row[s.name!] = this.toFiniteNumberOrNull(val);
      });

      return row;
    });
  }

  private toFiniteNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  private updateChart(series: TemperatureSeries[], years: number[]): void {
    const legendData = series.map((s) => s.name!).filter(Boolean);

    this.chartOption = {
      title: {
        text: this.selectedStation ? `Station: ${this.selectedStation.name}` : 'Temperature Chart',
        left: 'center',
      },

      tooltip: {
        trigger: 'axis',
      },

      legend: {
        bottom: 0,
        data: legendData,
        selectedMode: false,
      },

      xAxis: {
        type: 'category',
        name: 'YEAR',
        boundaryGap: false,
        data: years.map((y) => y.toString()),
      },

      yAxis: {
        type: 'value',
        name: '°C',
      },

      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 25 }],

      series: series.map((s) => ({
        name: s.name!,
        type: 'line',
        smooth: false,
        connectNulls: false,
        data: s.data,
        symbol: 'circle',
        symbolSize: 5,

        sampling: 'lttb',

        progressive: 500,
        progressiveThreshold: 3000,
      })),
    };
  }

  onFilterChange(): void {
    if (this.selectedStationId) {
      this.loadStationDetails(this.selectedStationId);
    }
  }

  onReset(): void {
    this.resetView();
  }

  private resetView(): void {
    this.stations = [];
    this.selectedStation = null;
    this.yearlyTableData = [];
    this.errorMessage = null;
    this.initChart();
  }
}
