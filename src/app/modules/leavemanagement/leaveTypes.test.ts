import {
  LEAVE_TYPES,
  isLeaveType,
  remainingDaysForType,
  typeToBalanceLeftKey,
  typeToBalanceField,
} from './leaveTypes';

describe('leaveTypes', () => {
  it('maps each API type to balance field and left key', () => {
    expect(typeToBalanceField('casual')).toBe('casualLeave');
    expect(typeToBalanceField('sick')).toBe('sickLeave');
    expect(typeToBalanceField('earn')).toBe('earnLeave');
    expect(typeToBalanceField('wp')).toBe('wpLeave');

    expect(typeToBalanceLeftKey('casual')).toBe('casualLeaveLeft');
    expect(typeToBalanceLeftKey('earn')).toBe('earnLeaveLeft');
  });

  it('isLeaveType validates canonical codes', () => {
    for (const t of LEAVE_TYPES) {
      expect(isLeaveType(t)).toBe(true);
    }
    expect(isLeaveType('annual')).toBe(false);
  });

  it('remainingDaysForType reads the correct left bucket', () => {
    const balances = {
      casualLeaveLeft: 5,
      sickLeaveLeft: 1,
      earnLeaveLeft: 10,
      wpLeaveLeft: 0,
    };
    expect(remainingDaysForType(balances, 'earn')).toBe(10);
    expect(remainingDaysForType(balances, 'wp')).toBe(0);
  });
});
