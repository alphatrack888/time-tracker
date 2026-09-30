import ExcelJS from 'exceljs';
import { MonthlyReportData } from './pdfHelper';
import { AttendanceReportData } from './attendanceReportTypes';

const toHours = (ms: number) => Number((ms / 1000 / 60 / 60).toFixed(2));

const styleHeaderRow = (row: ExcelJS.Row) => {
  row.font = { bold: true };
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    cell.border = { bottom: { style: 'thin' } };
  });
};

/**
 * Same underlying data as the PDF timesheet report (generateComprehensiveTimesheetReport
 * in pdfHelper.ts) — one row per work session, not per day, so a company
 * admin can pivot/filter in a spreadsheet rather than just reading a
 * formatted document. A summary sheet sits alongside the detail sheet.
 */
export const generateMonthlyTimesheetExcel = async (data: MonthlyReportData): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Alpha Track';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 24 },
    { header: 'Value', key: 'value', width: 30 },
  ];
  styleHeaderRow(summarySheet.getRow(1));
  summarySheet.addRows([
    { field: 'Employee', value: data.employeeName },
    { field: 'Email', value: data.employeeEmail || '' },
    { field: 'Company', value: data.companyName || '' },
    { field: 'Month', value: data.month },
    { field: 'Total days worked', value: data.totals.days },
    { field: 'Total sessions', value: data.totals.sessions },
    { field: 'Total work hours', value: toHours(data.totals.workMs) },
    { field: 'Total break hours', value: toHours(data.totals.breakMs) },
  ]);

  const detailSheet = workbook.addWorksheet('Sessions');
  detailSheet.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Project', key: 'project', width: 22 },
    { header: 'Start Time', key: 'startTime', width: 20 },
    { header: 'End Time', key: 'endTime', width: 20 },
    { header: 'Work Hours', key: 'workHours', width: 12 },
    { header: 'Break Hours', key: 'breakHours', width: 12 },
  ];
  styleHeaderRow(detailSheet.getRow(1));

  for (const day of data.daily) {
    if (day.sessions.length === 0) {
      detailSheet.addRow({ date: day.date, project: '', startTime: '', endTime: '', workHours: 0, breakHours: 0 });
      continue;
    }
    for (const session of day.sessions) {
      const breakMs = session.breaks.reduce((sum, b) => sum + b.durationMs, 0);
      detailSheet.addRow({
        date: session.date,
        project: session.project || '',
        startTime: session.startTime ? new Date(session.startTime).toLocaleString() : '',
        endTime: session.endTime ? new Date(session.endTime).toLocaleString() : '',
        workHours: toHours(session.workMs),
        breakHours: toHours(breakMs),
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const generateAttendanceReportExcel = async (data: AttendanceReportData): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Alpha Track';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Employee', key: 'employee', width: 24 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Present Days', key: 'present', width: 14 },
    { header: 'Absent Days', key: 'absent', width: 14 },
  ];
  styleHeaderRow(summarySheet.getRow(1));
  for (const emp of data.employees) {
    summarySheet.addRow({
      employee: emp.employeeName,
      email: emp.employeeEmail || '',
      present: emp.presentCount,
      absent: emp.absentCount,
    });
  }

  const detailSheet = workbook.addWorksheet('Daily Detail');
  detailSheet.columns = [
    { header: 'Employee', key: 'employee', width: 24 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Present', key: 'present', width: 10 },
    { header: 'Sessions', key: 'sessions', width: 10 },
    { header: 'Work Hours', key: 'workHours', width: 12 },
  ];
  styleHeaderRow(detailSheet.getRow(1));
  for (const emp of data.employees) {
    for (const day of emp.days) {
      detailSheet.addRow({
        employee: emp.employeeName,
        date: day.date,
        present: day.present ? 'Yes' : 'No',
        sessions: day.sessionsCount,
        workHours: toHours(day.workMs),
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};
