// Shared between pdfHelper.ts and excelHelper.ts so neither has to import
// from the other just to get at this shape.

export type AttendanceDayEntry = {
  date: string; // YYYY-MM-DD
  present: boolean;
  sessionsCount: number;
  workMs: number;
};

export type EmployeeAttendance = {
  employeeId: string;
  employeeName: string;
  employeeEmail?: string;
  days: AttendanceDayEntry[];
  presentCount: number;
  absentCount: number;
};

export type AttendanceReportData = {
  companyName?: string;
  startDate: string;
  endDate: string;
  employees: EmployeeAttendance[];
};
