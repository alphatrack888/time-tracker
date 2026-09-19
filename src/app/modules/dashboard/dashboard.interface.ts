export type AnalyticsQuery = {

  userId: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  period?: 'today' | 'yesterday' | 'week' | 'month' | 'last7days' | 'last30days';
  compare?: 'previous' | 'lastWeek' | 'lastMonth' | 'yesterday';
  includeChart?: boolean;
}

export type WorkingStats = {

  workingHours: number;
  breakHours: number;
  workingMinutes: number;
  breakMinutes: number;
  sessions: number;
}

export type DailyBreakdown = {
  date: string;
  day: string;
  workingHours: number;
  breakHours: number;
  sessions: number;
  formattedDate: string;
}

export type LocationQuery = {
  userId: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  period?: 'today' | 'yesterday' | 'week' | 'month' | 'last7days' | 'last30days';
  actions?: string[]; // filter by specific actions ['start', 'pause', 'resume', 'stop', 'periodic']
}

export type LocationPoint = {

  timestamp: Date;
  coordinates: [number, number]; // [longitude, latitude]
  action: 'start' | 'pause' | 'resume' | 'stop' | 'periodic';
  sessionId: string;
  sessionDate: string;
  project?: string;
}
