import { USER_ROLES } from "../../../enum/user"
import { User } from "../user/user.model"
import { Subscription } from "../subscription/subscription.model"
import { SubscriptionPlan } from "../subscription/subscription-plan.model"
import { stripeService } from "../subscription/stripe.service"
import { months } from "./dashboard.constants"
import { Project } from "../project/project.model"
import { JwtPayload } from "jsonwebtoken"
import { AnalyticsQuery, DailyBreakdown, LocationPoint, LocationQuery, WorkingStats } from "./dashboard.interface"
import moment from 'moment';
import { TimeSession } from "../timetracker/timetracker.model"

const getSystemAdminGeneralStats = async() =>{  
    const [totalCompany, totalEmployees, totalRevenues] = await Promise.all([
        User.countDocuments({role: USER_ROLES.COMPANY}),
        User.countDocuments({role: USER_ROLES.EMPLOYEES}),
       Subscription.aggregate([
        {
          $match: {
            status: { $in: ['active', 'trialing'] },
          }
        },
        {
          $lookup: {
            from: 'subscriptionplans',
            localField: 'planId',
            foreignField: '_id',
            as: 'plan'
          }
        },
        { $unwind: '$plan' },
        {
          $group: {
            _id: null,
            monthlyRevenue: {
              $sum: {
                $cond: [
                  { $eq: ['$plan.interval', 'month'] },
                  '$plan.price',
                  { $divide: ['$plan.price', 12] } // Convert yearly to monthly
                ]
              }
            }
          }
        }
      ])
    ])
    
    return {
        totalCompany,
        totalEmployees,
        totalRevenue: totalRevenues[0]?.totalRevenue || 0
    }
}



// Get monthly revenue data directly from Stripe
const getMonthlyRevenueFromStripe = async(year?: number) => {
    const currentYear = year || new Date().getFullYear()
    
    try {
        const monthlyData = await stripeService.getMonthlyRevenueData(currentYear)
        
        const chartData = months.map((month, index) => ({
            month,
            revenue: monthlyData[index]?.revenue || 0
        }))



        
        return {
            year: currentYear,
            data: chartData
        }
    } catch (error) {
        console.error('Error fetching revenue data from Stripe:', error)
        throw error
    }
}

const totalCompanyMonthly = async(year?: number) => {
    const currentYear = year || new Date().getFullYear()

    const totalCompanyMonthly = await User.aggregate([
        {
            $match: {
                role: USER_ROLES.COMPANY,
                createdAt: {$gte: new Date(`${currentYear}-01-01`), $lt: new Date(`${currentYear}-12-31`)}
            }
        },
        {
            $group: {
                _id: {
                    month: {$month: '$createdAt'},
                    year: {$year: '$createdAt'}
                },
                count: {$sum: 1}
            }
        }
    ])
    const totalCompanyMonthlyData = totalCompanyMonthly.reduce((acc, cur) => {
        acc[cur._id.month] = cur.count
        return acc
    }, {})
    const totalCompanyMonthlyChartData = months.map((month, index) => ({
        month,
        count: totalCompanyMonthlyData[index + 1] || 0
    }))
    return {
        year: currentYear,
        data: totalCompanyMonthlyChartData
    }


}

const getCompanyGeneralStats = async(user:JwtPayload) => {
    const [totalEmployees, totalProjects, totalCompletedProjects] = await Promise.all([
        User.countDocuments({role: USER_ROLES.EMPLOYEES, company:user.authId}),
        Project.countDocuments({}),
        Project.countDocuments({status: 'completed'}),

    ])
    return {
        totalEmployees,
        totalProjects,
        totalCompletedProjects
    }

    }


    const getTotalEmployeesDataYearly = async(year?:number) =>{
        const currentYear = year || new Date().getFullYear()
        const totalEmployeesYearly = await User.aggregate([
            {
                $match: {
                    role: USER_ROLES.EMPLOYEES,
                    createdAt: {$gte: new Date(`${currentYear}-01-01`), $lt: new Date(`${currentYear}-12-31`)}
                }
            },
            {
                $group: {
                    _id: {
                        month: {$month: '$createdAt'},
                        year: {$year: '$createdAt'}
                    },
                    count: {$sum: 1}
                }
            }
        ])
        const totalEmployeesYearlyData = totalEmployeesYearly.reduce((acc, cur) => {
            acc[cur._id.month] = cur.count
            return acc
        }, {})
        const totalEmployeesYearlyChartData = months.map((month, index) => ({
            month,
            count: totalEmployeesYearlyData[index + 1] || 0
        }))
        return {
            year: currentYear,
            data: totalEmployeesYearlyChartData
        }

    }

    const totalProjectYearlyData = async(year?:number) =>{
        const currentYear = year || new Date().getFullYear()
        const totalProjectYearly = await Project.aggregate([
            {
                $match: {
                    createdAt: {$gte: new Date(`${currentYear}-01-01`), $lt: new Date(`${currentYear}-12-31`)}
                }
            },
            {
                $group: {
                    _id: {
                        month: {$month: '$createdAt'},
                        year: {$year: '$createdAt'}
                    },
                    count: {$sum: 1}
                }
            }
        ])
        const totalProjectYearlyData = totalProjectYearly.reduce((acc, cur) => {
            acc[cur._id.month] = cur.count
            return acc
        }, {})
        const totalProjectYearlyChartData = months.map((month, index) => ({
            month,
            count: totalProjectYearlyData[index + 1] || 0
        }))
        return {
            year: currentYear,
            data: totalProjectYearlyChartData
        }







    }












/**
 * Calculate total working hours from time sessions
 */
const calculateWorkingHours = (sessions: any[]): WorkingStats => {
  let totalWorkingMinutes = 0;
  let totalBreakMinutes = 0;

  sessions.forEach(session => {
    if (session.totalTime) {
      totalWorkingMinutes += session.totalTime;
    }

    // Calculate break time from pauses
    if (session.pauses && session.pauses.length > 0) {
      session.pauses.forEach((pause: any) => {
        if (pause.start && pause.end) {
          const breakDuration = moment(pause.end).diff(moment(pause.start), 'minutes');
          totalBreakMinutes += breakDuration;
        }
      });
    }
  });

  return {
    workingHours: Math.round((totalWorkingMinutes / 60) * 100) / 100,
    breakHours: Math.round((totalBreakMinutes / 60) * 100) / 100,
    workingMinutes: totalWorkingMinutes,
    breakMinutes: totalBreakMinutes,
    sessions: sessions.length
  };
};

/**
 * Calculate percentage change between two values
 */
const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100 * 100) / 100;
};

/**
 * Get date range based on different input types
 */
const getDateRange = (query: Partial<AnalyticsQuery>) => {
  const { date, startDate, endDate, period } = query;

  // Single date input
  if (date) {
    return {
      startDate: date,
      endDate: date
    };
  }

  // Date range input
  if (startDate && endDate) {
    return {
      startDate,
      endDate
    };
  }

  // Predefined periods
  if (period) {
    const today = moment();
    
    switch (period) {
      case 'today':
        return {
          startDate: today.format('YYYY-MM-DD'),
          endDate: today.format('YYYY-MM-DD')
        };
      case 'yesterday':
        const yesterday = today.clone().subtract(1, 'day');
        return {
          startDate: yesterday.format('YYYY-MM-DD'),
          endDate: yesterday.format('YYYY-MM-DD')
        };
      case 'week':
        return {
          startDate: today.clone().startOf('week').format('YYYY-MM-DD'),
          endDate: today.clone().endOf('week').format('YYYY-MM-DD')
        };
      case 'month':
        return {
          startDate: today.clone().startOf('month').format('YYYY-MM-DD'),
          endDate: today.clone().endOf('month').format('YYYY-MM-DD')
        };
      case 'last7days':
        return {
          startDate: today.clone().subtract(6, 'days').format('YYYY-MM-DD'),
          endDate: today.format('YYYY-MM-DD')
        };
      case 'last30days':
        return {
          startDate: today.clone().subtract(29, 'days').format('YYYY-MM-DD'),
          endDate: today.format('YYYY-MM-DD')
        };
    }
  }

  // Default to today
  return {
    startDate: moment().format('YYYY-MM-DD'),
    endDate: moment().format('YYYY-MM-DD')
  };
};

/**
 * Get comparison date range
 */
const getComparisonDateRange = (
  currentStart: string, 
  currentEnd: string, 
  compareType: string = 'previous'
) => {
  const start = moment(currentStart);
  const end = moment(currentEnd);

  switch (compareType) {
    case 'previous': {
      const duration = end.diff(start, 'days') + 1;
      const previousEnd = start.clone().subtract(1, 'day');
      const previousStart = previousEnd.clone().subtract(duration - 1, 'days');
      return {
        startDate: previousStart.format('YYYY-MM-DD'),
        endDate: previousEnd.format('YYYY-MM-DD')
      };
    }
    case 'lastWeek':
      return {
        startDate: start.clone().subtract(1, 'week').format('YYYY-MM-DD'),
        endDate: end.clone().subtract(1, 'week').format('YYYY-MM-DD')
      };
    case 'lastMonth':
      return {
        startDate: start.clone().subtract(1, 'month').format('YYYY-MM-DD'),
        endDate: end.clone().subtract(1, 'month').format('YYYY-MM-DD')
      };
    case 'yesterday':
      const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
      return {
        startDate: yesterday,
        endDate: yesterday
      };
    default:
      return {
        startDate: start.clone().subtract(1, 'day').format('YYYY-MM-DD'),
        endDate: end.clone().subtract(1, 'day').format('YYYY-MM-DD')
      };
  }
};

/**
 * Generate daily breakdown for chart data
 */
const generateDailyBreakdown = (
  startDate: string, 
  endDate: string, 
  sessionsByDate: Record<string, any[]>
): DailyBreakdown[] => {
  const dates: string[] = [];
  const currentDate = moment(startDate);
  const endMoment = moment(endDate);

  while (currentDate <= endMoment) {
    dates.push(currentDate.format('YYYY-MM-DD'));
    currentDate.add(1, 'day');
  }

  return dates.map(date => {
    const daySessions = sessionsByDate[date] || [];
    const dayStats = calculateWorkingHours(daySessions);
    
    return {
      date,
      day: moment(date).format('dddd'),
      workingHours: dayStats.workingHours,
      breakHours: dayStats.breakHours,
      sessions: daySessions.length,
      formattedDate: moment(date).format('MMM DD')
    };
  });
};

/**
 * Main service function for comprehensive time analytics
 */
export const getTimeAnalytics = async (query: AnalyticsQuery) => {
  const { userId, compare = 'previous', includeChart = false } = query;

  // Get current period dates
  const currentRange = getDateRange(query);
  
  // Get comparison period dates
  const comparisonRange = getComparisonDateRange(
    currentRange.startDate, 
    currentRange.endDate, 
    compare
  );

  // Fetch current and comparison data
  const [currentSessions, comparisonSessions] = await Promise.all([
    TimeSession.find({
      user: userId,
      date: {
        $gte: currentRange.startDate,
        $lte: currentRange.endDate
      }
    }).sort({ date: 1 }),
    TimeSession.find({
      user: userId,
      date: {
        $gte: comparisonRange.startDate,
        $lte: comparisonRange.endDate
      }
    }).sort({ date: 1 })
  ]);

  // Calculate statistics
  const currentStats = calculateWorkingHours(currentSessions);
  const comparisonStats = calculateWorkingHours(comparisonSessions);

  // Calculate differences and percentages
  const workingHoursDiff = currentStats.workingHours - comparisonStats.workingHours;
  const breakHoursDiff = currentStats.breakHours - comparisonStats.breakHours;
  
  const workingHoursPercentage = calculatePercentageChange(
    currentStats.workingHours, 
    comparisonStats.workingHours
  );
  
  const breakHoursPercentage = calculatePercentageChange(
    currentStats.breakHours, 
    comparisonStats.breakHours
  );

  // Build base response
  const response: any = {
    currentPeriod: {
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
      workingHours: currentStats.workingHours,
      breakHours: currentStats.breakHours,
      sessions: currentStats.sessions,
      workingMinutes: currentStats.workingMinutes,
      breakMinutes: currentStats.breakMinutes
    },
    comparisonPeriod: {
      startDate: comparisonRange.startDate,
      endDate: comparisonRange.endDate,
      workingHours: comparisonStats.workingHours,
      breakHours: comparisonStats.breakHours,
      sessions: comparisonStats.sessions,
      workingMinutes: comparisonStats.workingMinutes,
      breakMinutes: comparisonStats.breakMinutes
    },
    comparison: {
      workingHours: {
        difference: Math.round(workingHoursDiff * 100) / 100,
        percentage: workingHoursPercentage,
        trend: workingHoursDiff >= 0 ? 'increase' : 'decrease'
      },
      breakHours: {
        difference: Math.round(breakHoursDiff * 100) / 100,
        percentage: breakHoursPercentage,
        trend: breakHoursDiff >= 0 ? 'increase' : 'decrease'
      }
    },
    summary: {
      totalWorkingHours: currentStats.workingHours,
      totalBreakHours: currentStats.breakHours,
      totalSessions: currentStats.sessions,
      averageDailyHours: currentStats.sessions > 0 ? 
        Math.round((currentStats.workingHours / Math.max(1, moment(currentRange.endDate).diff(moment(currentRange.startDate), 'days') + 1)) * 100) / 100 : 0,
      efficiency: currentStats.workingHours > 0 ? 
        Math.round(((currentStats.workingHours / (currentStats.workingHours + currentStats.breakHours)) * 100) * 100) / 100 : 0
    }
  };

  // Add daily breakdown for chart if requested
  if (includeChart) {
    // Group current sessions by date
    const sessionsByDate = currentSessions.reduce((acc: { [x: string]: any[] }, session: { date: string | number }) => {
      if (!acc[session.date]) {
        acc[session.date] = [];
      }
      acc[session.date].push(session);
      return acc;
    }, {} as Record<string, any[]>);

    const dailyBreakdown = generateDailyBreakdown(
      currentRange.startDate, 
      currentRange.endDate, 
      sessionsByDate
    );

    response.chartData = {
      dailyBreakdown,
      labels: dailyBreakdown.map(day => day.formattedDate),
      workingHoursData: dailyBreakdown.map(day => day.workingHours),
      breakHoursData: dailyBreakdown.map(day => day.breakHours),
      chartSummary: {
        totalDays: dailyBreakdown.length,
        maxWorkingHours: Math.max(...dailyBreakdown.map(day => day.workingHours)),
        maxBreakHours: Math.max(...dailyBreakdown.map(day => day.breakHours)),
        avgWorkingHours: Math.round((dailyBreakdown.reduce((sum, day) => sum + day.workingHours, 0) / dailyBreakdown.length) * 100) / 100,
        avgBreakHours: Math.round((dailyBreakdown.reduce((sum, day) => sum + day.breakHours, 0) / dailyBreakdown.length) * 100) / 100
      }
    };
  }

  return response;
};

/**
 * Get employee locations for admin
 */
export const getEmployeeLocations = async (query: LocationQuery) => {
  const { userId, actions } = query;

  // Get date range
  const dateRange = getDateRange(query);

  // Fetch time sessions with locations
  const sessions = await TimeSession.find({
    user: userId,
    date: {
      $gte: dateRange.startDate,
      $lte: dateRange.endDate
    },
    'locations.0': { $exists: true } // Only sessions with locations
  })
  .populate<{ project: { title: string } }>('project', '_id title')
  .populate<{ user: { _id: string, name: string, email: string } }>('user', '_id name email')


  .sort({ date: 1, startTime: 1 });

  // Extract location points
  const locations: LocationPoint[] = [];

  sessions.forEach(session => {
    if (session.locations && session.locations.length > 0) {
      session.locations.forEach(location => {
        // Apply action filter if specified
        if (actions && actions.length > 0 && !actions.includes(location.action)) {
          return;
        }

        locations.push({
          timestamp: location.timestamp,
          coordinates: location.coordinates,
          action: location.action,
          sessionId: session._id.toString(),
          sessionDate: session.date,
          project: session.project?.title ?? 'No Project',

        });
      });
    }
  });

  // Sort locations by timestamp
  locations.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Calculate summary stats
  const actionBreakdown = locations.reduce((acc, location) => {
    acc[location.action] = (acc[location.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const projectBreakdown = locations.reduce((acc, location) => {
    const project = location.project || 'No Project';
    acc[project] = (acc[project] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sessionBreakdown = sessions.map(session => ({
    sessionId: session._id,
    date: session.date,
    project: session.project?.title || 'No Project',
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    locationCount: session.locations?.length || 0,
    totalTime: session.totalTime || 0
  }));

  const response = {
    employee: sessions.length > 0 ? {
      id: sessions[0].user._id,
      name: sessions[0].user.name,
      email: sessions[0].user.email
    } : null,
    dateRange,
    totalLocations: locations.length,
    totalSessions: sessions.length,
    locations,
    summary: {
      actionBreakdown,
      projectBreakdown,
      sessionBreakdown,
      timeRange: locations.length > 0 ? {
        start: locations[0].timestamp,
        end: locations[locations.length - 1].timestamp
      } : null
    }
  };

  // Add map bounds for easy map rendering
  if (locations.length > 0) {
    const lons = locations.map(loc => loc.coordinates[0]);
    const lats = locations.map(loc => loc.coordinates[1]);
    
    (response as any).mapBounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lons),
      west: Math.min(...lons),
      center: [
        (Math.max(...lons) + Math.min(...lons)) / 2,
        (Math.max(...lats) + Math.min(...lats)) / 2
      ]
    };
  }

  return response;
};












export const dashboardService = {
    getSystemAdminGeneralStats,
    getMonthlyRevenueFromStripe,
    totalCompanyMonthly,
    getTotalEmployeesDataYearly,
    totalProjectYearlyData,
    getCompanyGeneralStats,
    getTimeAnalytics,
    getEmployeeLocations
}