import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeroService } from '../../hero.service';
import { downloadCsvLines } from '../../shared/export/csv-export';

@Component({
  selector: 'app-dashboard-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-content">
      <div class="header">
        <h2>Dashboard</h2>
      </div>
      
      <div class="controls">
      <!--  <div class="date-range">&lt; Mar 1, 2023 - Mar 7, 2023 &gt;</div>
        <select class="interval">
          <option>Weekly</option>
        </select>-->
        <button type="button" class="export-btn" (click)="exportDashboardCsv()"><span>📥</span> Export CSV</button>
      </div>

      <div class="stats-cards">
        <div class="card">
          <div class="label">Total Candidates Applied</div>
          <div class="value-row">
            <span class="value">{{ totalCandidatesApplied }}</span>
           <!-- <span class="badge green">↗ 12%</span> -->
          </div>
        </div>
        <div class="card">
          <div class="label">Total Candidates Selected</div>
          <div class="value-row">
            <span class="value">{{ totalCandidatesSelected }}</span>
           <!--  <span class="badge green">↗ 15%</span> -->
          </div>
        </div>
        <div class="card">
          <div class="label">Recent Candidates Hired</div>
          <div class="value-row">
             <span class="value">{{ recentlyHiredCandidates }}</span>
            <!--  <span class="badge green">↗ 5%</span> -->
          </div>
        </div>
        <div class="card">
          <div class="label">Currently Inprogress Candidates</div>
          <div class="value-row">
            <span class="value">{{ totalInProgressCandidates }}</span>
           <!--  <span class="badge green">↗ 12%</span> -->
          </div>
        </div>
      </div>

      <div class="middle-section" style="display: flex; flex-direction: column; gap: 24px;">
        <div class="chart-section job-stats" style="flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3>Application Statistics</h3>
            <div style="display: flex; align-items: center; gap: 12px">
              <span style="font-size: 13px; color: #64748b; font-weight: 500;">Year To Date</span>
              <select [(ngModel)]="selectedYear" (change)="onYearChange()" style="padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; color: #334155; outline: none; cursor: pointer;">
                <option *ngFor="let year of availableYears" [value]="year">{{year}}</option>
              </select>
            </div>
          </div>
          
          <div class="custom-bar-chart">
            <div class="chart-bars-container">
               <!-- Y-axis guide lines -->
               <div class="guide-lines">
                 <div class="line"></div>
                 <div class="line"></div>
                 <div class="line"></div>
                 <div class="line"></div>
                 <div class="line"></div>
               </div>

               <div class="bar-group" *ngFor="let data of chartData">
                 <div class="bars">
                   <div class="bar applied-bar" [style.height.%]="(data.applied / maxChartValue) * 100" title="Applied: {{data.applied}}">
                     <span class="bar-label">{{data.applied}}</span>
                   </div>
                   <div class="bar selected-bar" [style.height.%]="(data.selected / maxChartValue) * 100" title="Selected: {{data.selected}}">
                     <span class="bar-label">{{data.selected}}</span>
                   </div>
                 </div>
                 <span class="month-label">{{data.month}}</span>
               </div>
            </div>
            
            <div class="chart-legend">
               <div class="legend-item"><span class="color-box applied-box"></span> Candidates Applied</div>
               <div class="legend-item"><span class="color-box selected-box"></span> Candidates Selected</div>
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 24px;">
          <!-- Moving work format here due to layout adjustment for better chart width -->
          <div class="chart-section" style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <h3 style="margin: 0;">Application Breakdown</h3>
              <select [(ngModel)]="selectedRole" (change)="onRoleChange()" style="padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; color: #334155; outline: none; cursor: pointer;">
                <option *ngFor="let role of availableRoles" [value]="role">{{role}}</option>
              </select>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-around; padding: 20px 0;">
                <!-- Pie Chart -->
                <div [style.background]="getPieChartGradient()" style="width: 180px; height: 180px; border-radius: 50%; position: relative; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); transition: background 0.5s ease-in-out;">
                   <div style="width: 120px; height: 120px; background: white; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                      <span style="font-size: 13px; color: #64748b; margin-bottom: 4px;">Total</span>
                      <strong style="font-size: 24px; color: #1e293b; line-height: 1;">{{currentPieData.total}}</strong>
                   </div>
                </div>
                <!-- Legend -->
                <div style="display: flex; flex-direction: column; gap: 14px;">
                   <div style="display: flex; align-items: center; justify-content: space-between; gap: 24px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                         <span style="width: 14px; height: 14px; border-radius: 4px; background: #6366f1;"></span> 
                         <span style="font-size: 14px; color: #334155; font-weight: 500;">Total Candidates Applied</span>
                      </div>
                      <strong style="color: #1e293b; font-size: 15px">{{currentPieData.applied}}</strong>
                   </div>
                   <div style="display: flex; align-items: center; justify-content: space-between; gap: 24px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                         <span style="width: 14px; height: 14px; border-radius: 4px; background: #10b981;"></span> 
                         <span style="font-size: 14px; color: #334155; font-weight: 500;">Candidates Selected</span>
                      </div>
                      <strong style="color: #1e293b; font-size: 15px">{{currentPieData.selected}}</strong>
                   </div>
                   <div style="display: flex; align-items: center; justify-content: space-between; gap: 24px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                         <span style="width: 14px; height: 14px; border-radius: 4px; background: #3b82f6;"></span> 
                         <span style="font-size: 14px; color: #334155; font-weight: 500;">Application In Progress</span>
                      </div>
                      <strong style="color: #1e293b; font-size: 15px">{{currentPieData.inProgress}}</strong>
                   </div>
                   <div style="display: flex; align-items: center; justify-content: space-between; gap: 24px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                         <span style="width: 14px; height: 14px; border-radius: 4px; background: #f59e0b;"></span> 
                         <span style="font-size: 14px; color: #334155; font-weight: 500;">Candidates Opt Out</span>
                      </div>
                      <strong style="color: #1e293b; font-size: 15px">{{currentPieData.optOut}}</strong>
                   </div>
                </div>
            </div>
          </div>
        </div>
      </div>


    </div>
  `,
  styleUrls: ['../../hr-dashboard/hr-dashboard.scss'],
  styles: [`
    .custom-bar-chart {
      display: flex;
      flex-direction: column;
      height: 280px;
      margin-top: 20px;
      font-family: 'Inter', sans-serif;
      position: relative;
    }
    .chart-bars-container {
      display: flex;
      justify-content: space-around;
      align-items: flex-end;
      flex: 1;
      padding-bottom: 30px;
      position: relative;
      z-index: 10;
    }
    .guide-lines {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 30px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      z-index: -1;
    }
    .line {
      height: 1px;
      background-color: #f1f5f9;
      width: 100%;
    }
    .line:last-child {
      background-color: #cbd5e1;
    }
    .bar-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      justify-content: flex-end;
      position: relative;
    }
    .bars {
      display: flex;
      align-items: flex-end;
      height: 100%;
      justify-content: center;
      gap: 6px;
      width: 44px;
    }
    .bar {
      width: 16px;
      border-radius: 4px 4px 0 0;
      position: relative;
      transition: height 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      cursor: pointer;
    }
    .applied-bar {
      background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%);
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
    }
    .selected-bar {
      background: linear-gradient(180deg, #34d399 0%, #059669 100%);
      box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.2);
    }
    .bar:hover {
      filter: brightness(1.1);
    }
    .bar-label {
      position: absolute;
      top: -24px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 11px;
      font-weight: 700;
      color: #334155;
      opacity: 0;
      transition: opacity 0.2s, top 0.2s;
      background: white;
      padding: 2px 6px;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      z-index: 20;
    }
    .bar:hover .bar-label {
      opacity: 1;
      top: -28px;
    }
    .month-label {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      position: absolute;
      bottom: -25px;
    }
    .chart-legend {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 25px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      font-size: 13px;
      color: #334155;
      font-weight: 600;
    }
    .color-box {
      width: 12px;
      height: 12px;
      border-radius: 3px;
      margin-right: 8px;
    }
    .applied-box {
      background: #3b82f6;
    }
    .selected-box {
      background: #10b981;
    }
    
    .middle-section {
      width: 100%;
    }
  `]
})
export class DashboardTab implements OnInit {
  totalCandidatesApplied: string | number = 'Loading...';
  totalCandidatesSelected: string | number = 'Loading...';
  totalInProgressCandidates: string | number = 'Loading...';
  recentlyHiredCandidates: string | number = 'Loading...';
  constructor(private hs: HeroService) { }

  ngOnInit() {
    //debugger;
    this.fetchTotalApplied();
    this.fetchTotalCandidatesSelected();
    this.fetchCurrentlyInProgressCandidates();
    this.fetchRecentlyHiredCandidates();
    this.fetchMonthlyStats(this.selectedYear);
   // debugger;
  }

  fetchTotalApplied() {
    this.hs.ajax(
      'GetTotalAppliedCandiatesCount',
      'http://schemas.cordys.com/RMST1DatabaseMetadata',
      {}
    ).then((resp: any) => {
      console.log('Total Applied RPC Response:', resp);
      try {
        this.totalCandidatesApplied = resp.tuple.old.ts_applications.count;
      } catch (e) {
        console.error('Error parsing response from GetTotalAppliedCandiatesCount:', e);
        this.totalCandidatesApplied = 'Error';
      }
    }).catch((err: any) => {
      console.error('Error in GetTotalAppliedCandiatesCount AJAX call:', err);
      this.totalCandidatesApplied = 'Error';
    });
  }

  fetchCurrentlyInProgressCandidates() {
    this.hs.ajax(
      'CurrentlyInProgressCandidates',
      'http://schemas.cordys.com/RMST1DatabaseMetadata',
      {}
    ).then((resp: any) => {
      console.log('Total Selected RPC Response:', resp);
      try {
        // Defaulting to the same parsing structure as fetchTotalApplied
        this.totalInProgressCandidates = resp.tuple.old.ts_applications.count;
      } catch (e) {
        console.error('Error parsing response from GetTotalCandidatesSelectedCount:', e);
        this.totalInProgressCandidates = 'Error';
      }
    }).catch((err: any) => {
      console.error('Error in GetTotalCandidatesSelectedCount AJAX call:', err);
      this.totalInProgressCandidates = 'Error';
    });
  }

  fetchTotalCandidatesSelected() {
    this.hs.ajax(
      'GetAllSelectedCandidatesCount',
      'http://schemas.cordys.com/RMST1DatabaseMetadata',
      {}
    ).then((resp: any) => {
      console.log('Total Selected RPC Response:', resp);
      try {
        // Defaulting to the same parsing structure as fetchTotalApplied
        this.totalCandidatesSelected = resp.tuple.old.ts_offers.count;
      } catch (e) {
        console.error('Error parsing response from GetTotalCandidatesSelectedCount:', e);
        this.totalCandidatesSelected = 'Error';
      }
    }).catch((err: any) => {
      console.error('Error in GetTotalCandidatesSelectedCount AJAX call:', err);
      this.totalCandidatesSelected = 'Error';
    });
  }

  fetchRecentlyHiredCandidates() {
    this.hs.ajax(
      'GetRecentHiresCount',
      'http://schemas.cordys.com/RMST1DatabaseMetadata',
      {}
    ).then((resp: any) => {
      console.log('Total Selected RPC Response:', resp);
      try {
        // Defaulting to the same parsing structure as fetchTotalApplied
        this.recentlyHiredCandidates = resp.tuple.old.ts_offers.count;
      } catch (e) {
        console.error('Error parsing response from GetTotalCandidatesSelectedCount:', e);
        this.recentlyHiredCandidates = 'Error';
      }
    }).catch((err: any) => {
      console.error('Error in GetTotalCandidatesSelectedCount AJAX call:', err);
      this.recentlyHiredCandidates = 'Error';
    });
  }
  selectedYear = new Date().getFullYear();
  availableYears = [2022, 2023, 2024, 2025, 2026];

  // Cache for monthly stats per year (optional)
  monthlyStats: Record<number, Array<{ month: string, applied: number, selected: number }>> = {};

  // Fetch monthly statistics for a given year from the SOAP service
  fetchMonthlyStats(year: number) {
    this.hs.ajax(
      'GetMonthlyStatsByYear',
      'http://schemas.cordys.com/RMST1DatabaseMetadata',
      { year }
    ).then((resp: any) => {
      try {
        // Normalize the tuple(s) to an array – the SOAP response may return a single object or an array
        const rawTuples = resp.tuple;
        const tuples = rawTuples ? (Array.isArray(rawTuples) ? rawTuples : [rawTuples]) : [];
        console.log('Fetched tuples:', tuples);
        const data = tuples.map((t: any) => {
          // The TABLE element may itself be an array; grab the first one if so
          const table = Array.isArray(t.old?.TABLE) ? t.old.TABLE[0] : t.old?.TABLE;
          // if (!table) return null;
          // Convert month ISO string to a short month name (e.g., "Mar")
          const monthDate = new Date(table.month);
          const month = monthDate.toLocaleString('default', { month: 'short' });
          return {
            month,
            applied: Number(table.applied_count),
            selected: Number(table.selected_count)
          };
        }).filter(Boolean);
        this.chartData = data;
        // cache if needed
        this.monthlyStats[year] = data;
      } catch (e) {
        console.error('Error parsing monthly stats response:', e);
        this.chartData = [];
      }
    }).catch((err: any) => {
      console.error('Error fetching monthly stats:', err);
      this.chartData = [];
    });
  }

  chartData: Array<{ month: string, applied: number, selected: number }> = [];

  get maxChartValue() {
    // Add 15% padding to the top of the chart so the highest bar isn't hitting the roof
    const max = Math.max(...this.chartData.map(d => Math.max(d.applied, d.selected)));
    return max * 1.15;
  }

  onYearChange() {
    // Load data for the newly selected year
    this.fetchMonthlyStats(this.selectedYear);
  }

  /** Export current chart data + summary KPIs as CSV */
  exportDashboardCsv(): void {
    const year = this.selectedYear;
    const lines: string[][] = [
      ['HR Dashboard export', '', ''],
      ['Generated', new Date().toISOString(), ''],
      ['Year', String(year), ''],
      [],
      ['Metric', 'Value', ''],
      ['Total candidates applied', String(this.totalCandidatesApplied), ''],
      ['Total candidates selected', String(this.totalCandidatesSelected), ''],
      ['Currently in progress', String(this.totalInProgressCandidates), ''],
      ['Recently hired', String(this.recentlyHiredCandidates), ''],
      [],
      ['Month', 'Applied', 'Selected']
    ];
    for (const d of this.chartData || []) {
      lines.push([d.month, String(d.applied), String(d.selected)]);
    }
    downloadCsvLines(`hr-dashboard-${year}.csv`, lines);
  }

  // --- Pie Chart Sector Data & Logic ---
  selectedRole = 'All Roles';
  availableRoles = ['All Roles', 'Frontend Developer', 'Backend Developer', 'UX Designer'];

  pieDataByRole: Record<string, { total: number, applied: number, selected: number, inProgress: number, optOut: number }> = {
    'All Roles': { total: 412, applied: 185, selected: 82, inProgress: 104, optOut: 41 },
    'Frontend Developer': { total: 150, applied: 70, selected: 35, inProgress: 35, optOut: 10 },
    'Backend Developer': { total: 180, applied: 80, selected: 30, inProgress: 45, optOut: 25 },
    'UX Designer': { total: 82, applied: 35, selected: 17, inProgress: 24, optOut: 6 }
  };

  currentPieData = this.pieDataByRole['All Roles'];

  onRoleChange() {
    this.currentPieData = this.pieDataByRole[this.selectedRole] || this.pieDataByRole['All Roles'];
  }

  getPieChartGradient() {
    const data = this.currentPieData;
    const t = data.total;
    if (t === 0) return 'none';

    // Calculate cumulative percentages for the conic-gradient
    const appliedPct = (data.applied / t) * 100;
    const inProgressPct = appliedPct + ((data.inProgress / t) * 100);
    const selectedPct = inProgressPct + ((data.selected / t) * 100);

    // The conic-gradient colors follow the order in the legend:
    // Applied (Indigo) -> In Progress (Blue) -> Selected (Emerald) -> Opt Out (Orange)
    return `conic-gradient(#6366f1 0% ${appliedPct}%, #3b82f6 ${appliedPct}% ${inProgressPct}%, #10b981 ${inProgressPct}% ${selectedPct}%, #f59e0b ${selectedPct}% 100%)`;
  }
}