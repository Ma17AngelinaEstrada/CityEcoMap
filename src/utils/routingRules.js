import { OFFICES } from '../constants/offices';

const WASTE_RULES = {
  'Illegal Dumping': { primary: OFFICES.CENRO },
  'Uncollected Garbage': { primary: OFFICES.CENRO },
  'Waste Affecting Rivers, Waterways, and Natural Water Bodies': { primary: OFFICES.EMB },
  'Other': { primary: OFFICES.CENRO },
};

const DRAINAGE_RULES = {
  'Clogged Drainage': { primary: OFFICES.CITY_ENGINEERING },
  'Damaged Drainage': { primary: OFFICES.CITY_ENGINEERING },
  'Flooding': { primary: OFFICES.CITY_ENGINEERING },
  'Other': { primary: OFFICES.CITY_ENGINEERING },
};

const RULES_BY_CATEGORY = {
  'Waste Issue': WASTE_RULES,
  'Drainage Issue': DRAINAGE_RULES,
};

export function routeReport({ category, subCategory }) {
  const rules = RULES_BY_CATEGORY[category];
  if (!rules) return { primaryOffice: null, needsReview: true };

  // Citizens who pick "Other" never actually submit the literal string
  // "Other" — SubmitReport.js already swaps it for their free-text
  // specification before this runs. So we detect "Other" by exclusion:
  // anything that isn't one of this category's known predefined
  // subCategories gets the category's 'Other' rule instead.
  const knownKeys = Object.keys(rules).filter((k) => k !== 'Other');
  const rule = knownKeys.includes(subCategory) ? rules[subCategory] : rules['Other'];

  if (!rule || rule.needsReview) {
    return { primaryOffice: null, needsReview: true };
  }
  return { primaryOffice: rule.primary };
}