export const OFFICES = {
  EMB: 'EMB',
  CENRO: 'CENRO',
  CITY_ENGINEERING: 'City Engineering',
};

// Retired — hindi na active operational office.
export const RETIRED_OFFICES = {
  GSO: 'GSO',
};

// Offices na napag-usapan pero hindi pa active.
export const FUTURE_OFFICES = {
  DPWH: 'DPWH',
  CDRRMO: 'CDRRMO',
  SANITATION: 'Sanitation Office',
};

export const ACTIVE_OFFICE_LIST = Object.values(OFFICES); // ['EMB', 'CENRO', 'City Engineering']
export const ALL_OFFICE_LABELS = [...ACTIVE_OFFICE_LIST, ...Object.values(RETIRED_OFFICES)];

export const OFFICE_ROLES = ['Master Admin', 'EMB Admin', 'CENRO Admin', 'City Engineering Admin'];

export const ROLE_TO_OFFICE = {
  'Master Admin': OFFICES.EMB,
  'EMB Admin': OFFICES.EMB,
  'CENRO Admin': OFFICES.CENRO,
  'City Engineering Admin': OFFICES.CITY_ENGINEERING,
};

export const isMasterRole = (role) => role === 'Master Admin';
export const officeForRole = (role) => ROLE_TO_OFFICE[role] || null;

export const officeLabel = (report) => {
  if (report.primaryOffice) return report.primaryOffice;
  if (report.jurisdictionCandidates?.length) return 'Jurisdiction Verification';
  if (report.needsReview) return 'Needs Review';
  return '—';
};