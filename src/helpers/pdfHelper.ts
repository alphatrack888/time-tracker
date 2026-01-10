import PDFDocument from 'pdfkit';

type DailySessionBreak = { start?: Date; end?: Date; durationMs: number };
type DailySession = {
  date: string;
  project?: string;
  startTime?: Date;
  endTime?: Date;
  workMs: number;
  breaks: DailySessionBreak[];
};

export type MonthlyReportData = {
  employeeName: string;
  employeeEmail?: string;
  companyName?: string;
  month: string; // YYYY-MM
  totals: { workMs: number; breakMs: number; days: number; sessions: number };
  daily: Array<{
    date: string;
    workMs: number;
    breakMs: number;
    sessions: DailySession[];
  }>;
};

const toHours = (ms: number) => (ms / 1000 / 60 / 60);
const toHoursStr = (ms: number) => toHours(ms).toFixed(2) + ' h';
const toMinutesStr = (ms: number) => (ms / 1000 / 60).toFixed(0) + ' min';

export const generateMonthlyTimeReportPdf = async (data: MonthlyReportData): Promise<Buffer> => {
  const doc = new PDFDocument({ margin: 40 });
  const chunks: Buffer[] = [];

  return await new Promise<Buffer>((resolve) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Header
    doc.fontSize(20).text('Monthly Time Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Month: ${data.month}`);
    doc.text(`Employee: ${data.employeeName}${data.employeeEmail ? ` <${data.employeeEmail}>` : ''}`);
    if (data.companyName) doc.text(`Company: ${data.companyName}`);
    doc.moveDown();

    // Totals
    doc.fontSize(14).text('Summary');
    doc.fontSize(12)
      .text(`Total Work: ${toHoursStr(data.totals.workMs)}`)
      .text(`Total Break: ${toHoursStr(data.totals.breakMs)} (${toMinutesStr(data.totals.breakMs)})`)
      .text(`Days Tracked: ${data.totals.days}`)
      .text(`Sessions: ${data.totals.sessions}`);
    doc.moveDown();

    // Daily breakdown
    doc.fontSize(14).text('Daily Breakdown');
    doc.moveDown(0.5);
    data.daily.forEach((day) => {
      doc.fontSize(12).text(`Date: ${day.date}`);
      doc.text(`Work: ${toHoursStr(day.workMs)} | Break: ${toHoursStr(day.breakMs)} (${toMinutesStr(day.breakMs)}) | Sessions: ${day.sessions.length}`);
      // Sessions details
      day.sessions.forEach((s, idx) => {
        const startStr = s.startTime ? new Date(s.startTime).toLocaleTimeString() : '-';
        const endStr = s.endTime ? new Date(s.endTime).toLocaleTimeString() : '-';
        doc.text(`  #${idx + 1} Project: ${s.project ?? 'N/A'} | ${startStr} - ${endStr} | Work: ${toHoursStr(s.workMs)}`);
        if (s.breaks && s.breaks.length) {
          const totalBreakMs = s.breaks.reduce((acc, b) => acc + (b.durationMs || 0), 0);
          doc.text(`     Breaks: ${toMinutesStr(totalBreakMs)} total`);
        }
      });
      doc.moveDown();
    });

    doc.end();
  });
};

export const generateComprehensiveTimesheetReport = async (data: MonthlyReportData, lang: 'en' | 'de' = 'en'): Promise<Buffer> => {
  const locale = lang === 'de' ? 'de-DE' : 'en-US';
  const translations = {
    en: {
      title: 'ALPHA-TRACK EMPLOYEE TIMESHEET REPORT',
      employeeInfo: 'EMPLOYEE INFORMATION',
      name: 'Name',
      email: 'Email',
      company: 'Company',
      reportPeriod: 'Report Period',
      headers: ['Day', 'Date', 'Project(s)', 'Time In', 'Time Out', 'Work Hrs', 'Break Hrs', 'Total Hrs'] as const,
      monthlySummary: 'MONTHLY SUMMARY',
      totalWorkingHours: 'Total Working Hours',
      totalBreakTime: 'Total Break Time',
      numberOfProjects: 'Number of Projects',
      workingDays: 'Working Days',
      projects: 'Projects',
      hours: 'hours',
      employeeSignature: 'Employee Signature',
      supervisorSignature: 'Supervisor Signature',
      date: 'Date'
    },
    de: {
      title: 'ALPHA-TRACK MITARBEITER ZEITKARTENBERICHT',
      employeeInfo: 'MITARBEITERINFORMATIONEN',
      name: 'Name',
      email: 'E-Mail',
      company: 'Unternehmen',
      reportPeriod: 'Berichtszeitraum',
      headers: ['Tag', 'Datum', 'Projekt(e)', 'Eingangszeit', 'Auszugszeit', 'Arbeitsstunden', 'Pausenstunden', 'Gesamtstunden'] as const,
      monthlySummary: 'MONATLICHE ZUSAMMENFASSUNG',
      totalWorkingHours: 'Gesamtarbeitsstunden',
      totalBreakTime: 'Gesamtpausenzeit',
      numberOfProjects: 'Anzahl der Projekte',
      workingDays: 'Arbeitstage',
      projects: 'Projekte',
      hours: 'Stunden',
      employeeSignature: 'Mitarbeiter Unterschrift',
      supervisorSignature: 'Vorgesetzter Unterschrift',
      date: 'Datum'
    }
  } as const;
  const t = translations[lang];

  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  const chunks: Buffer[] = [];

  const borderColor = '#000000';
  const headerBg = '#3F80AE';
  const headerFg = '#ffffff';
  const rowAltBg = '#f8f9fa';
  const summaryBg = '#e8f4f8';

  const toHrs = (ms: number) => (ms / 1000 / 60 / 60);
  const toHrsStr = (ms: number) => toHrs(ms).toFixed(2);

  const [year, monthStr] = data.month.split('-');
  const monthIndex = parseInt(monthStr, 10) - 1;
  const daysInMonth = new Date(parseInt(year, 10), monthIndex + 1, 0).getDate();
  const monthName = new Date(parseInt(year, 10), monthIndex, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  // Process daily data and calculate project statistics
  const byDate: Record<string, { workMs: number; breakMs: number; start?: Date; end?: Date; projects: string[] }> = {};
  const allProjects = new Set<string>();
  
  data.daily.forEach(d => {
    const start = d.sessions.reduce<Date | undefined>((acc, s) => (!acc || (s.startTime && new Date(s.startTime) < acc)) ? s.startTime : acc, undefined);
    const end = d.sessions.reduce<Date | undefined>((acc, s) => (!acc || (s.endTime && new Date(s.endTime) > acc)) ? s.endTime : acc, undefined);
    const projects = Array.from(new Set(d.sessions.map(s => s.project).filter(Boolean))) as string[];
    projects.forEach(p => allProjects.add(p));
    
    (byDate[d.date] ||= { workMs: 0, breakMs: 0, projects: [] }).workMs += d.workMs;
    (byDate[d.date]).breakMs += d.breakMs;
    (byDate[d.date]).start = start;
    (byDate[d.date]).end = end;
    (byDate[d.date]).projects = projects;
  });

  const rows = Array.from({ length: daysInMonth }).map((_, i) => {
    const day = i + 1;
    const dateKey = `${data.month}-${String(day).padStart(2, '0')}`;
    const dayData = byDate[dateKey];
    
    return {
      date: day,
      dayName: new Date(parseInt(year, 10), monthIndex, day).toLocaleDateString(locale, { weekday: 'short' }),
      projects: dayData?.projects.join(', ') || '',
      timeIn: dayData?.start ? new Date(dayData.start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      timeOut: dayData?.end ? new Date(dayData.end).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      workHours: dayData?.workMs ? toHrsStr(dayData.workMs) : '',
      breakHours: dayData?.breakMs ? toHrsStr(dayData.breakMs) : '',
      totalHours: dayData ? toHrsStr(dayData.workMs + dayData.breakMs) : ''
    };
  });

  return await new Promise<Buffer>((resolve) => {
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Header with company branding
    doc.rect(0, 0, doc.page.width, 80).fill(headerBg);
    doc.fillColor(headerFg).fontSize(24).font('Helvetica-Bold').text(t.title, 30, 20, { align: 'center' });

    // Employee details section - prominently displayed
    doc.y = 100;
    doc.fillColor('#000000');
    
    // Employee info box - with proper styling
    const infoBoxY = doc.y;
    const infoBoxHeight = 80;
    
    // Draw info box background and border
    doc.rect(30, infoBoxY, doc.page.width - 60, infoBoxHeight)
       .fill('#f8f9fa')
       .stroke(borderColor);
    
    // Employee information text - ensure it's visible
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text(t.employeeInfo, 50, infoBoxY + 15);
    doc.fontSize(12).font('Helvetica');
    
    // Employee details - with proper positioning
    doc.text(`${t.name}: ${data.employeeName}`, 50, infoBoxY + 40);
    if (data.employeeEmail) {
      doc.text(`${t.email}: ${data.employeeEmail}`, 50, infoBoxY + 55);
    }
    if (data.companyName) {
      doc.text(`${t.company}: ${data.companyName}`, 300, infoBoxY + 40);
    }
    doc.text(`${t.reportPeriod}: ${monthName}`, 300, infoBoxY + 55);

    // Table setup - FIXED COLUMN COUNT (8 columns total)
    doc.y = infoBoxY + infoBoxHeight + 20; // Add some space after info box
    const startY = doc.y;
    const x = 30;
    const tableWidth = doc.page.width - 60; // 30px margin on both sides
    
    // Correct column widths for 8 columns (Day, Date, Project(s), Time In, Time Out, Work Hrs, Break Hrs, Total Hrs)
    const colWidths = [35, 35, 100, 60, 60, 60, 60, tableWidth - (35+35+100+60+60+60+60)]; // Total: 475px (should be <= tableWidth)
    
    let y = startY;

    // Table header - FIXED: Only draw 8 columns
    doc.fillColor(headerFg).rect(x, y, tableWidth, 35).fill(headerBg);
    
    const headers = t.headers;
    
    // Verify we have exactly 8 headers for 8 columns
    if (headers.length !== colWidths.length) {
      throw new Error(`Header count (${headers.length}) doesn't match column count (${colWidths.length})`);
    }
    
    let cx = x;
    
    doc.fillColor(headerFg).fontSize(10).font('Helvetica-Bold');
    headers.forEach((header, idx) => {
      doc.text(header, cx + 3, y + 12, { 
        width: colWidths[idx] - 6, 
        align: 'center' 
      });
      // Draw header cell border
      doc.rect(cx, y, colWidths[idx], 35).stroke();
      cx += colWidths[idx];
    });

    y += 35;

    // Table rows - FIXED: Only process 8 columns
    rows.forEach((row, idx) => {
      const rowHeight = 25;
      const isAlt = idx % 2 === 1;
      
      // Alternating row background
      if (isAlt) {
        doc.rect(x, y, tableWidth, rowHeight).fill(rowAltBg);
      }

      // Row data - FIXED: Only 8 cells
      let cx2 = x;
      const cells = [
        row.dayName,
        row.date.toString(),
        row.projects,
        row.timeIn,
        row.timeOut,
        row.workHours,
        row.breakHours,
        row.totalHours
      ];

      // Verify cell count matches column count
      if (cells.length !== colWidths.length) {
        throw new Error(`Cell count (${cells.length}) doesn't match column count (${colWidths.length})`);
      }
      
      cells.forEach((cellValue, cidx) => {
        doc.fillColor('#000000').fontSize(8).font('Helvetica');
        const textAlign = (cidx === 0 || cidx === 1) ? 'center' : 'left';
        
        // Draw cell content
        doc.text(String(cellValue), cx2 + 3, y + 8, { 
          width: colWidths[cidx] - 6, 
          align: textAlign 
        });
        
        // Draw cell border
        doc.rect(cx2, y, colWidths[cidx], rowHeight).stroke();
        cx2 += colWidths[cidx];
      });
      
      y += rowHeight;
      
      // Page break if needed
      if (y > doc.page.height - 200) {
        doc.addPage();
        y = 50;
        
        // Redraw table header on new page
        doc.fillColor(headerFg).rect(x, y, tableWidth, 35).fill(headerBg);
        let headerX = x;
        headers.forEach((header, idx) => {
          doc.fillColor(headerFg).fontSize(10).font('Helvetica-Bold')
             .text(header, headerX + 3, y + 12, { width: colWidths[idx] - 6, align: 'center' });
          doc.rect(headerX, y, colWidths[idx], 35).stroke();
          headerX += colWidths[idx];
        });
        y += 35;
      }
    });

    // Monthly Summary Section
    const summaryY = y + 30;
    doc.rect(x, summaryY, tableWidth, 120).fill(summaryBg).stroke();
    
    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text(t.monthlySummary, x + 20, summaryY + 15);
    
    doc.fontSize(11).font('Helvetica');
    const totalWorkHours = toHrsStr(data.totals.workMs);
    const totalBreakHours = toHrsStr(data.totals.breakMs);
    const totalProjects = allProjects.size;
    const workingDays = data.totals.days;
    
    doc.text(`${t.totalWorkingHours}: ${totalWorkHours} ${t.hours}`, x + 20, summaryY + 40);
    doc.text(`${t.totalBreakTime}: ${totalBreakHours} ${t.hours}`, x + 20, summaryY + 55);
    doc.text(`${t.numberOfProjects}: ${totalProjects}`, x + 20, summaryY + 70);
    doc.text(`${t.workingDays}: ${workingDays}`, x + 20, summaryY + 85);
    
    if (allProjects.size > 0) {
      doc.text(`${t.projects}: ${Array.from(allProjects).join(', ')}`, x + 300, summaryY + 40, { width: 250 });
    }

    // === SIGNATURE SECTION AT PAGE BOTTOM ===
    const sigY = doc.page.height - 100;
    const sigLineWidth = 200;

    doc.moveTo(x + 20, sigY).lineTo(x + 20 + sigLineWidth, sigY).stroke();
    doc.fontSize(10).fillColor('#000').text(t.employeeSignature, x + 20, sigY + 8);
    doc.text(`${t.date}: _______________`, x + 20, sigY + 25);

    const rightX = doc.page.width - 60 - sigLineWidth;
    doc.moveTo(rightX, sigY).lineTo(rightX + sigLineWidth, sigY).stroke();
    doc.text(t.supervisorSignature, rightX, sigY + 8);
    doc.text(`${t.date}: _______________`, rightX, sigY + 25);

    doc.end();
  });
};


type TimesheetRow = {
  dateLabel: string;
  location: string;
  timeFrom: string;
  timeTo: string;
  breakMinutes: string;
  netHours: string;
};

export const generateTimesheetStyleMonthlyReport = async (data: MonthlyReportData): Promise<Buffer> => {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  const chunks: Buffer[] = [];

  const borderColor = '#000000';
  const headerBg = '#000000';
  const headerFg = '#ffffff';
  const rowAltBg = '#e8e8e8';

  const toHrs = (ms: number) => (ms / 1000 / 60 / 60);
  const toHrsStr = (ms: number) => toHrs(ms).toFixed(2);
  const toMinStr = (ms: number) => Math.round(ms / 1000 / 60).toString();

  const [year, monthStr] = data.month.split('-');
  const monthIndex = parseInt(monthStr, 10) - 1;
  const daysInMonth = new Date(parseInt(year, 10), monthIndex + 1, 0).getDate();

  const byDate: Record<string, { workMs: number; breakMs: number; start?: Date; end?: Date; location: string }[]> = {};
  data.daily.forEach(d => {
    const start = d.sessions.reduce<Date | undefined>((acc, s) => (!acc || (s.startTime && new Date(s.startTime) < acc)) ? s.startTime : acc, undefined);
    const end = d.sessions.reduce<Date | undefined>((acc, s) => (!acc || (s.endTime && new Date(s.endTime) > acc)) ? s.endTime : acc, undefined);
    const location = (() => {
      const titles = Array.from(new Set(d.sessions.map(s => s.project).filter(Boolean))) as string[];
      if (titles.length === 0) return '';
      if (titles.length === 1) return titles[0]!;
      return 'Multiple';
    })();
    (byDate[d.date] ||= []).push({ workMs: d.workMs, breakMs: d.breakMs, start, end, location });
  });

  const rows: TimesheetRow[] = Array.from({ length: daysInMonth }).map((_, i) => {
    const day = i + 1;
    const dateLabel = `${day}.`;
    const dateKey = `${data.month}-${String(day).padStart(2, '0')}`;
    const items = byDate[dateKey] || [];
    const workMs = items.reduce((a, b) => a + b.workMs, 0);
    const breakMs = items.reduce((a, b) => a + b.breakMs, 0);
    const start = items.reduce<Date | undefined>((acc, s) => (!acc || (s.start && s.start < acc)) ? s.start : acc, undefined);
    const end = items.reduce<Date | undefined>((acc, s) => (!acc || (s.end && s.end > acc)) ? s.end : acc, undefined);
    const location = items.length ? items[0].location : '';

    const timeFrom = start ? new Date(start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
    const timeTo = end ? new Date(end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
    const breakMinutes = breakMs ? `${toMinStr(breakMs)}` : '';
    const netHours = workMs ? `${toHrsStr(workMs)}` : '';

    return { dateLabel, location, timeFrom, timeTo, breakMinutes, netHours };
  });

  return await new Promise<Buffer>((resolve) => {
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Black header band with ALPHA branding
    doc.rect(0, 0, doc.page.width, 50).fill(headerBg);
    doc.fillColor(headerFg).fontSize(18).font('Helvetica-Bold').text('ALPHA', doc.page.width - 120, 15, { align: 'right' });
    doc.fontSize(12).font('Helvetica').text('time', doc.page.width - 120, 32, { align: 'right' });

    // Move down and add month/employee info
    doc.y = 80;
    doc.fillColor('#000000').fontSize(11);
    doc.text(`Monat: ${data.month}`, 30, doc.y);
    doc.moveDown(0.5);
    doc.text(`Mitarbeiter: ${data.employeeName}`, 30, doc.y);

    // Table setup
    const startY = doc.y + 20;
    const x = 30;
    const tableWidth = doc.page.width - 60;
    
    // Column widths adjusted to match the image proportions
    const colWidths = [50, 120, 80, 80, 80, 100];
    let y = startY;

    // Table header with black background
    doc.fillColor(headerFg).rect(x, y, tableWidth, 30).fill(headerBg);
    
    // Header text
    const headers = ['Datum', 'Einsatzort', 'Von', 'Bis', 'Pause', 'Stunden (Netto)'];
    let cx = x;
    
    // Add "Uhrzeit" spanning header for Von/Bis columns
    doc.fillColor(headerFg).fontSize(10).font('Helvetica-Bold');
    doc.text('Uhrzeit', cx + colWidths[0] + colWidths[1] + 10, y + 5);
    
    // Individual column headers
    cx = x;
    headers.forEach((header, idx) => {
      let headerY = y + 8;
      if (idx === 2 || idx === 3) {
        headerY = y + 15; // Lower position for Von/Bis under Uhrzeit
      }
      doc.text(header, cx + 5, headerY, { width: colWidths[idx] - 10, align: 'center' });
      cx += colWidths[idx];
    });

    // Header borders
    doc.strokeColor(borderColor).lineWidth(1);
    cx = x;
    headers.forEach((_, idx) => {
      doc.rect(cx, y, colWidths[idx], 30).stroke();
      cx += colWidths[idx];
    });
    
    y += 30;

    // Table rows
    rows.forEach((row, idx) => {
      const rowHeight = 25;
      const isAlt = idx % 2 === 1;
      
      // Alternating row background
      if (isAlt) {
        doc.rect(x, y, tableWidth, rowHeight).fill(rowAltBg);
      }

      // Row data
      let cx2 = x;
      const cells = [row.dateLabel, row.location, row.timeFrom, row.timeTo, row.breakMinutes, row.netHours];
      
      cells.forEach((cellValue, cidx) => {
        doc.fillColor('#000000').fontSize(9).font('Helvetica');
        const textAlign = cidx === 0 ? 'center' : 'left'; // Center align date numbers
        doc.text(cellValue, cx2 + 5, y + 8, { 
          width: colWidths[cidx] - 10, 
          align: textAlign 
        });
        
        // Cell borders
        doc.strokeColor(borderColor).lineWidth(1).rect(cx2, y, colWidths[cidx], rowHeight).stroke();
        cx2 += colWidths[cidx];
      });
      
      y += rowHeight;
      
      // Page break if needed
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = 50;
      }
    });

    // Signature lines at bottom
    const sigY = Math.max(y + 40, doc.page.height - 80);
    const sigLineWidth = 180;
    
    // Left signature line
    doc.moveTo(x + 20, sigY).lineTo(x + 20 + sigLineWidth, sigY).stroke();
    doc.fontSize(9).fillColor('#000000').text('UNTERSCHRIFT', x + 20, sigY + 8);
    
    // Right date line
    const rightX = doc.page.width - 60 - sigLineWidth;
    doc.moveTo(rightX, sigY).lineTo(rightX + sigLineWidth, sigY).stroke();
    doc.text('DATUM', rightX, sigY + 8);

    doc.end();
  });
};