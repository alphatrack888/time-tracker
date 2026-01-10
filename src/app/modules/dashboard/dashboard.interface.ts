export interface AnalyticsQuery {

  userId: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  period?: 'today' | 'yesterday' | 'week' | 'month' | 'last7days' | 'last30days';
  compare?: 'previous' | 'lastWeek' | 'lastMonth' | 'yesterday';
  includeChart?: boolean;
}

export interface WorkingStats {

  workingHours: number;
  breakHours: number;
  workingMinutes: number;
  breakMinutes: number;
  sessions: number;
}

export interface DailyBreakdown {
  date: string;
  day: string;
  workingHours: number;
  breakHours: number;
  sessions: number;
  formattedDate: string;
}

export interface LocationQuery {
  userId: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  period?: 'today' | 'yesterday' | 'week' | 'month' | 'last7days' | 'last30days';
  actions?: string[]; // filter by specific actions ['start', 'pause', 'resume', 'stop', 'periodic']
}

export interface LocationPoint {

  timestamp: Date;
  coordinates: [number, number]; // [longitude, latitude]
  action: 'start' | 'pause' | 'resume' | 'stop' | 'periodic';
  sessionId: string;
  sessionDate: string;
  project?: string;
}
