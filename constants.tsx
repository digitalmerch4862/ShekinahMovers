
import React from 'react';

export const CURRENCY = 'PHP';
export const DISTANCE_UNIT = 'KM';

export const HOLIDAYS = [
  { date: '2024-01-01', name: 'New Year\'s Day' },
  { date: '2024-04-09', name: 'Araw ng Kagitingan' },
  { date: '2024-05-01', name: 'Labor Day' },
  { date: '2024-06-12', name: 'Independence Day' },
  { date: '2024-08-26', name: 'National Heroes Day' },
  { date: '2024-11-01', name: 'All Saints\' Day' },
  { date: '2024-12-25', name: 'Christmas Day' },
  { date: '2024-12-30', name: 'Rizal Day' }
];

export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  fuel: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  tolls: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  // ... more icons
};
