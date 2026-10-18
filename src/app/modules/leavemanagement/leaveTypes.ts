export const LEAVE_TYPES = ['casual', 'sick', 'earn', 'wp'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  casual: 'Casual Leave',
  sick: 'Sick Leave',
  earn: 'Earn Leave',
  wp: 'Without Pay Leave',
};

export type LeaveBalanceField =
  | 'casualLeave'
  | 'sickLeave'
  | 'earnLeave'
  | 'wpLeave';

export type LeaveBalanceLeftKey =
  | 'casualLeaveLeft'
  | 'sickLeaveLeft'
  | 'earnLeaveLeft'
  | 'wpLeaveLeft';

const TYPE_TO_BALANCE_FIELD: Record<LeaveType, LeaveBalanceField> = {
  casual: 'casualLeave',
  sick: 'sickLeave',
  earn: 'earnLeave',
  wp: 'wpLeave',
};

const TYPE_TO_BALANCE_LEFT_KEY: Record<LeaveType, LeaveBalanceLeftKey> = {
  casual: 'casualLeaveLeft',
  sick: 'sickLeaveLeft',
  earn: 'earnLeaveLeft',
  wp: 'wpLeaveLeft',
};

export function isLeaveType(value: string): value is LeaveType {
  return (LEAVE_TYPES as readonly string[]).includes(value);
}

export function typeToBalanceField(type: LeaveType): LeaveBalanceField {
  return TYPE_TO_BALANCE_FIELD[type];
}

export function typeToBalanceLeftKey(type: LeaveType): LeaveBalanceLeftKey {
  return TYPE_TO_BALANCE_LEFT_KEY[type];
}

export interface LeaveBalanceLeftMap {
  casualLeaveLeft: number;
  sickLeaveLeft: number;
  earnLeaveLeft: number;
  wpLeaveLeft: number;
}

export function remainingDaysForType(
  balances: LeaveBalanceLeftMap,
  type: LeaveType,
): number {
  const key = typeToBalanceLeftKey(type);
  const remaining = balances[key];
  return typeof remaining === 'number' ? remaining : 0;
}
