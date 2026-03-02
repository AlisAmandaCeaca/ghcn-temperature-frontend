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

  onSearch(): void {
    this.searchClicked = true;
    if (this.searchParams.latitude === null || this.searchParams.longitude === null) {
      this.errorMessage = 'Bitte gebe Koordinaten ein.';
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
          this.errorMessage = 'Keine Stationen vorhanden.';
        }

        this.selectedStationId = '';
        this.selectedStation = null;
        this.yearlyTableData = [];
        this.initChart();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Fehler beim Laden der Stationen.';
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
                name: `${period === 'YEAR' ? 'Jahr' : period} ${type === 'MIN' ? 'Min' : 'Max'}`,
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
        this.errorMessage = 'Fehler beim Laden der Stationsdetails.';
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
        text: this.selectedStation ? `Station: ${this.selectedStation.name}` : 'Temperaturverlauf',
        left: 'center',
      },
      tooltip: { trigger: 'axis' },
      legend: {
        bottom: 0,
        show: true,
        data: legendData,
      },
      grid: { top: 60, bottom: 80, left: 50, right: 20 },
      xAxis: {
        type: 'category',
        data: years.map((y) => y.toString()),
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        name: '°C',
        axisLabel: { formatter: '{value} °C' },
      },
      series: series.map((s) => ({
        name: s.name ?? 'Unbekannt',
        type: 'line',
        smooth: true,
        connectNulls: true,
        data: s.data,
        symbol: 'circle',
        symbolSize: 6,
      })),
    };
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
