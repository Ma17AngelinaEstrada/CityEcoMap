import { OFFICES } from '../constants/offices';

// Offices that may receive or act on operational reports. EMB is monitoring-only.
export const OPERATIONAL_OFFICE_LIST = [OFFICES.CENRO, OFFICES.CITY_ENGINEERING];

export const isMonitoringRole = (role) => role === 'EMB Admin' || role === 'Master Admin';
export const canManageReports = (role) => ['Master Admin', 'CENRO Admin', 'City Engineering Admin'].includes(role);
export const canExportReports = (role) => ['Master Admin', 'CENRO Admin', 'City Engineering Admin'].includes(role);
export const canManageUsers = (role) => role === 'Master Admin';
