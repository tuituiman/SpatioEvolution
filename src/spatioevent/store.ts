import { create } from 'zustand'

export type GroupingMode = 'daily' | 'hourly' | 'shift' | 'day_night' | 'custom_2h' | 'custom_4h';

export interface TimePeriod {
  key: string;       // "YYYY-MM-DD HH:00" etc.
  label: string;     // Thai readable label
  date: Date;        // representing the start of the bucket
}

export interface MappedRow {
  lat: number;
  lng: number;
  date: Date;
  label: string;
  value: number;
  raw: any;
}

export interface SpatioEventState {
  rawRows: any[];
  columns: string[];
  dataKeys: {
    lat: string;
    lng: string;
    dateTime: string;
    label: string;
  };
  pointRadiusBuffer: number;
  playSpeed: number;
  isPlaying: boolean;
  currentStep: number;
  periods: TimePeriod[];
  dictionary: Record<string, MappedRow[]>;
  groupingMode: GroupingMode;
  selectedDatasetName: string | null;
  baseMapStyle: 'dark' | 'street' | 'satellite';
  zoom: number;
  showZeroAreas: boolean;
  isCumulative: boolean;
  
  // Actions
  setRawRows: (rows: any[], fileName: string) => void;
  setDataKeys: (keys: SpatioEventState['dataKeys']) => void;
  setPointRadiusBuffer: (val: number) => void;
  setPlaySpeed: (val: number) => void;
  setIsPlaying: (val: boolean) => void;
  setCurrentStep: (val: number) => void;
  setGroupingMode: (mode: GroupingMode) => void;
  setBaseMapStyle: (style: SpatioEventState['baseMapStyle']) => void;
  setIsCumulative: (val: boolean) => void;
  resetAll: () => void;
}

export const useSpatioEventStore = create<SpatioEventState>((set, get) => ({
  rawRows: [],
  columns: [],
  dataKeys: { lat: '', lng: '', dateTime: '', label: '' },
  pointRadiusBuffer: 0,
  playSpeed: 800,
  isPlaying: false,
  currentStep: 0,
  periods: [],
  dictionary: {},
  groupingMode: 'hourly',
  selectedDatasetName: null,
  baseMapStyle: 'street',
  zoom: 12,
  showZeroAreas: true,
  isCumulative: false,

  setRawRows: (rows, fileName) => {
    const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
    set({
      rawRows: rows,
      columns: cols,
      selectedDatasetName: fileName,
      periods: [],
      dictionary: {},
      currentStep: 0,
      isPlaying: false
    });
  },

  setDataKeys: (keys) => {
    set({ dataKeys: keys });
    rebuildPeriodsAndDictionary(get(), set);
  },

  setPointRadiusBuffer: (val) => set({ pointRadiusBuffer: val }),
  setPlaySpeed: (val) => set({ playSpeed: val }),
  setIsPlaying: (val) => set({ isPlaying: val }),
  setCurrentStep: (val) => set({ currentStep: val }),
  
  setGroupingMode: (mode) => {
    set({ groupingMode: mode });
    rebuildPeriodsAndDictionary(get(), set);
  },

  setBaseMapStyle: (style) => set({ baseMapStyle: style }),
  setIsCumulative: (val) => set({ isCumulative: val }),

  resetAll: () => set({
    rawRows: [],
    columns: [],
    dataKeys: { lat: '', lng: '', dateTime: '', label: '' },
    pointRadiusBuffer: 0,
    isPlaying: false,
    currentStep: 0,
    periods: [],
    dictionary: {},
    selectedDatasetName: null,
    isCumulative: false
  })
}));

// Utility functions for sub-daily date parsing and grouping

export function parseSubDailyDate(val: any): Date | null {
  if (!val && val !== 0) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  
  // Excel numeric decimal parse
  if (typeof val === 'number') {
    // 25569 = Jan 1 1970
    // fractional part represents time of day
    if (val > 20000) {
      const ms = Math.round((val - 25569) * 86400000);
      return new Date(ms);
    }
    return null;
  }

  const s = val.toString().trim();
  if (!s) return null;

  // Try parsing ISO/native
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  // Try custom regex formats (e.g. DD/MM/YYYY HH:mm:ss, DD-MM-YYYY HH:mm)
  const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) {
    const day = parseInt(m[1]);
    const month = parseInt(m[2]) - 1;
    let year = parseInt(m[3]);
    const hour = parseInt(m[4]);
    const min = parseInt(m[5]);
    const sec = m[6] ? parseInt(m[6]) : 0;

    if (year < 100) year += 2000;
    if (year > 2400) year -= 543; // BE to CE

    const isSystemBE = new Date(2000, 0, 1).getFullYear() === 2543;
    const adjustYear = isSystemBE ? year + 543 : year;
    return new Date(adjustYear, month, day, hour, min, sec);
  }

  return null;
}

function rebuildPeriodsAndDictionary(state: SpatioEventState, set: any) {
  const { rawRows, dataKeys, groupingMode } = state;
  if (rawRows.length === 0 || !dataKeys.lat || !dataKeys.lng || !dataKeys.dateTime) return;

  // 1. Map rows and filter out invalid rows
  const mapped: MappedRow[] = [];
  rawRows.forEach((row) => {
    const lat = parseFloat(row[dataKeys.lat]);
    const lng = parseFloat(row[dataKeys.lng]);
    const date = parseSubDailyDate(row[dataKeys.dateTime]);
    
    if (!isNaN(lat) && !isNaN(lng) && date) {
      mapped.push({
        lat,
        lng,
        date,
        label: row[dataKeys.label] ? row[dataKeys.label].toString() : 'พิกัดกรณีเคส',
        value: 1,
        raw: row
      });
    }
  });

  if (mapped.length === 0) return;

  // Sort chronologically
  mapped.sort((a, b) => a.date.getTime() - b.date.getTime());

  const minDate = mapped[0].date;
  const maxDate = mapped[mapped.length - 1].date;

  // 2. Generate period buckets and group rows
  const periods: TimePeriod[] = [];
  const dictionary: Record<string, MappedRow[]> = {};

  // Find start and end times rounded to appropriate intervals
  const startTime = new Date(minDate.getTime());
  if (groupingMode === 'daily') {
    startTime.setHours(0, 0, 0, 0);
  } else {
    startTime.setMinutes(0, 0, 0);
  }
  
  const endTime = new Date(maxDate.getTime());
  if (groupingMode === 'daily') {
    endTime.setHours(23, 59, 59, 999);
  } else {
    endTime.setMinutes(59, 59, 999);
  }

  let current = new Date(startTime.getTime());
  
  // Guard loop limits to avoid infinite loops or memory explosions
  let iterations = 0;
  const MAX_ITERATIONS = 10000;

  const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  while (current <= endTime && iterations < MAX_ITERATIONS) {
    iterations++;
    
    let key = '';
    let label = '';
    const nextStep = new Date(current.getTime());

    const isSystemBE = new Date(2000, 0, 1).getFullYear() === 2543;
    const getYearBE = (d: Date) => {
      const yr = d.getFullYear();
      const yrCE = isSystemBE ? yr - 543 : yr;
      return yrCE + 543;
    };

    const dateStr = `${current.getDate()} ${MONTHS_SHORT[current.getMonth()]} ${getYearBE(current)}`;

    if (groupingMode === 'daily') {
      key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      label = `${dateStr}`;
      nextStep.setDate(current.getDate() + 1);
      nextStep.setHours(0, 0, 0, 0);
    } else if (groupingMode === 'hourly') {
      const hh = String(current.getHours()).padStart(2, '0');
      key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')} ${hh}:00`;
      label = `${dateStr} เวลา ${hh}:00 น.`;
      nextStep.setHours(current.getHours() + 1);
    } else if (groupingMode === 'shift') {
      const h = current.getHours();
      let shift = 'ดึก (00:00 - 08:00)';
      if (h >= 8 && h < 16) {
        shift = 'เช้า (08:00 - 16:00)';
        current.setHours(8, 0, 0, 0);
      } else if (h >= 16) {
        shift = 'บ่าย (16:00 - 24:00)';
        current.setHours(16, 0, 0, 0);
      } else {
        current.setHours(0, 0, 0, 0);
      }
      key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')} Shift-${h >= 8 && h < 16 ? 'Morning' : (h >= 16 ? 'Afternoon' : 'Night')}`;
      label = `${dateStr} เวร${shift}`;
      nextStep.setHours(current.getHours() + 8);
    } else if (groupingMode === 'day_night') {
      const h = current.getHours();
      let term = 'กลางคืน (20:00 - 08:00)';
      if (h >= 8 && h < 20) {
        term = 'กลางวัน (08:00 - 20:00)';
        current.setHours(8, 0, 0, 0);
      } else {
        if (h >= 20) {
          current.setHours(20, 0, 0, 0);
        } else {
          // early hours before 8am (belongs to night shift of previous day or same night bucket)
          current.setHours(20, 0, 0, 0);
          current.setDate(current.getDate() - 1);
        }
      }
      key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')} Shift-${h >= 8 && h < 20 ? 'Day' : 'Night'}`;
      label = `${dateStr} ช่วง${term}`;
      nextStep.setHours(current.getHours() + 12);
    } else if (groupingMode === 'custom_2h') {
      const h = Math.floor(current.getHours() / 2) * 2;
      current.setHours(h, 0, 0, 0);
      const startH = String(h).padStart(2, '0');
      const endH = String(h + 2).padStart(2, '0');
      key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')} ${startH}:00-${endH}:00`;
      label = `${dateStr} เวลา ${startH}:00 - ${endH}:00 น.`;
      nextStep.setHours(current.getHours() + 2);
    } else if (groupingMode === 'custom_4h') {
      const h = Math.floor(current.getHours() / 4) * 4;
      current.setHours(h, 0, 0, 0);
      const startH = String(h).padStart(2, '0');
      const endH = String(h + 4).padStart(2, '0');
      key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')} ${startH}:00-${endH}:00`;
      label = `${dateStr} เวลา ${startH}:00 - ${endH}:00 น.`;
      nextStep.setHours(current.getHours() + 4);
    }

    periods.push({
      key,
      label,
      date: new Date(current.getTime())
    });

    dictionary[key] = [];
    current = nextStep;
  }

  // 3. Populate dictionary buckets
  mapped.forEach((pt) => {
    // Find the correct bucket key for pt.date
    const ptTime = pt.date.getTime();
    let bestPeriod = periods[0];
    const minDiff = Infinity;
    
    // Find closest bucket that starts BEFORE or EQUAL to the date
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      const nextP = periods[i + 1];
      const pStart = p.date.getTime();
      const pEnd = nextP ? nextP.date.getTime() : Infinity;

      if (ptTime >= pStart && ptTime < pEnd) {
        bestPeriod = p;
        break;
      }
    }

    if (bestPeriod) {
      dictionary[bestPeriod.key].push(pt);
    }
  });

  set({
    periods,
    dictionary,
    currentStep: 0
  });
}
