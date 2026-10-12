// Suggested Report Priority Level - informational decision support only.
//
// - Levels and criteria are PROPOSED by the CityEcoMap team. They are NOT
//   officially validated or approved by EMB, CENRO, or City Engineering.
// - The suggestion uses ONLY what the citizen wrote in the report description.
//   Category, sub-category, type of area, location/distance, photos and
//   submission time are deliberately NOT used.
// - It is calculated from the report each time it is displayed. Nothing is
//   saved to the database, and it never changes status, Primary/Supporting
//   Office, ownership, or escalation.
// - If the description does not clearly support a level: "Needs Assessment".

export const PRIORITY_RULES_VERSION = 'v2-2026-10';

export const PRIORITY_LEVELS = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  NEEDS_ASSESSMENT: 'Needs Assessment',
};

export const INDICATOR_GROUPS = {
  SAFETY: {
    label: 'Possible safety hazard stated',
    patterns: [
      // danger / harm stated outright
      { re: /\b(danger|dangerous|dangerously|unsafe|risky|peril\w*|harmful|delikado|mapanganib|peligro|peligroso|nakakapinsala)\b/gi, negatable: true },
      { re: /\b(safety|fire|public|physical|road)\s+(hazards?|risks?|concerns?|threats?)\b/gi, negatable: true },
      { re: /\b(banta|panganib|peligro)\s+sa\s+(buhay|kaligtasan|publiko|mga\s+tao|tao|bata|mga\s+bata|motorista|pedestrian\w*)\b/gi, negatable: true },
      { re: /\b(makasama|nakakasama|nakakasira|masama)\s+(sa|para\s+sa)\s+(mga\s+)?(tao|bata|residente|publiko|motorista|pedestrian\w*|naglalakad|matatanda)\b/gi, negatable: true },
      { re: /\b(harm|hurt|endanger\w*|threaten\w*)\s+(the\s+)?(people|residents|children|kids|public|pedestrians|motorists|elderly)\b/gi, negatable: true },
      // injury / accident / death
      { re: /\b(injur\w*|accident\w*|aksidente|naaksidente|disgrasya|nadisgrasya|nasugat\w*|nasaktan|casualt\w*|wounded|fatal\w*|namatay|nasawi|died|deaths?|killed)\b/gi, negatable: true },
      { re: /\b(nadulas|nadapa|slipped|nalunod|nalulunod|malunod|lunod|drown\w*)\b/gi, negatable: true },
      { re: /\bnahulog\s+sa\s+(kanal|drainage|imburnal|manhole|butas|ilog|estero|tubig)\b/gi, negatable: true },
      { re: /\b(fell|fall|falling)\s+(in|into)\s+(the\s+)?(canal|drain|drainage|manhole|hole|river|creek)\b/gi, negatable: true },
      { re: /\b(broken\s+glass|bubog|basag\s+na\s+(bote|salamin)|sharp\s+(objects?|metal|debris)|matutulis\s+na)\b/gi, negatable: true },
      // open / uncovered holes and drains
      { re: /\b(open|uncovered|exposed|missing)\s+(manholes?|drains?|drainage|canals?|ditch(es)?|holes?|sewers?|grates?)\b/gi, negatable: false },
      { re: /\b(missing|no|without)\s+(a\s+)?(cover|covers|manhole\s+cover|grate)\b/gi, negatable: false },
      { re: /\bbukas\s+na\s+(manhole|kanal|drainage|imburnal|alulod|butas|estero)\b/gi, negatable: false },
      { re: /\b(walang|wala\s+nang|nawawalang|sirang)\s+takip\b/gi, negatable: false },
      // structural failure
      { re: /\b(sinkhole|collaps\w*|gumuho|gumuguho|guguho)\b/gi, negatable: true },
      // fire / explosion / electricity
      { re: /\b(fire(?!\s+(station|hydrant|truck|department|exit|extinguisher))|sunog|nasusunog|nasunog|sinusunog|sinunog|apoy|burning|burnt|burned|explosi\w*|explode\w*|sumabog|sumasabog)\b/gi, negatable: true },
      { re: /\b(electrocut\w*|nakuryente|makuryente|nakukuryente|live\s+wires?|exposed\s+wires?|nakalawit\s+na\s+(kable|wire))\b/gi, negatable: true },
      // hazardous materials
      { re: /\b(toxic|toxins?|poison\w*|chemicals?|kemikal|lason|nakakalason|nakalalason|hazardous|medical\s+waste|hospital\s+waste|infectious\s+waste|syringes?|needles?|flammable)\b/gi, negatable: true },
    ],
  },
  ACCESS: {
    label: 'Road/walkway access stated as obstructed',
    patterns: [
      {
        re: /\b(block\w*|obstruct\w*|nakaharang|humaharang|naharang|hinaharangan|nakabara|bumabara|nakasagabal|sumasagabal|sagabal|nakakaabala|nakakasagabal)\b[^.!?\n]{0,40}\b(roads?|streets?|kalsada|daan|daanan|lansangan|kalye|highway|sidewalks?|bangketa|walkways?|pathways?|footpath|alley|eskinita|entrance|exit|pasukan|labasan|driveway|gate|tulay|bridge|crosswalk|traffic|trapiko|motorista|pedestrian\w*)\b/gi,
        negatable: true,
      },
      {
        re: /\b(roads?|streets?|kalsada|daan|daanan|lansangan|kalye|highway|sidewalks?|bangketa|walkways?|pathways?|footpath|alley|eskinita|entrance|exit|pasukan|labasan|driveway|gate|tulay|bridge|crosswalk)\b[^.!?\n]{0,30}\b(blocked|obstructed|nakaharang|nakabara|naharang|impassable)\b/gi,
        negatable: true,
      },
      { re: /\b(causes?|causing|nagdudulot\s+ng|nagiging\s+sanhi\s+ng|sanhi\s+ng|nagpapabagal\s+ng)\s+(heavy\s+|matinding\s+)?(traffic|trapiko|congestion|gridlock)\b/gi, negatable: true },
      {
        re: /\b(impassable|(hindi|di)\s+(na\s+)?(madaanan|madaan|makadaan|makatawid|makalabas|makapasok|makalakad|mapasok)|(cannot|can['’]?t|unable\s+to)\s+(pass|cross|walk|enter|exit)|no\s+way\s+through|nahihirapan\s+(dumaan|makadaan|maglakad|tumawid|makalabas)|(difficult|hard)\s+to\s+(pass|cross|walk))\b/gi,
        negatable: false,
      },
    ],
  },
  WATER: {
    label: 'Flooding, overflow or standing water stated',
    patterns: [
      {
        re: /\b(flood\w*|inundat\w*|submerg\w*|waterlogg\w*|overflow\w*|ponding|baha|binaha|binabaha|bumabaha|bumaha|babaha|bahain|pagbaha|pagbabaha|umaapaw|umapaw|apaw|pag-?apaw|lubog|lumubog|lumulubog|nalubog|lulubog)\b/gi,
        negatable: true,
      },
      { re: /\b(standing|stagnant|stagnating|accumulated|accumulating)\s+(flood\s+)?water\b/gi, negatable: true },
      { re: /\bwater\s+(accumulation|logging)\b/gi, negatable: true },
      { re: /\b(naiipon|nakatigil|nakatengga|nakatiwangwang|tumitigil)\s+(na\s+|ang\s+)?tubig\b/gi, negatable: true },
      { re: /\btubig\s+(na\s+)?(naiipon|nakatigil|nakatengga|tumataas)\b/gi, negatable: true },
      { re: /\b(tumataas|tumaas|rising)\s+(ang\s+|the\s+)?(tubig|water)\b/gi, negatable: true },
      { re: /\b(tubig|baha|water|flood\w*)\b[^.!?\n]{0,30}\b(hanggang|abot|up\s+to)\s+(sa\s+)?(tuhod|baywang|bewang|dibdib|leeg|bukung-?bukong|knees?|waist|chest|ankles?)\b/gi, negatable: true },
      { re: /\b(knee|waist|chest|ankle|neck)[-\s]?deep\b/gi, negatable: true },
    ],
  },
  HEALTH: {
    label: 'Foul odor, pests, disease or health risk stated',
    patterns: [
      // odor
      { re: /\b(foul|bad|strong|terrible|awful|unbearable)\s+(smell|odou?r|stench)\b/gi, negatable: true },
      { re: /\b(stench|stink\w*|smell\w*|odou?rs?|putrid|rotten|rotting|decompos\w*|fumes?)\b/gi, negatable: true },
      { re: /\b(baho|napakabaho|sobrang\s+baho|ang\s+baho|mabaho|mabahong|bumabaho|mabantot|bantot|umaalingasaw|alingasaw|masangsang|sangsang|nangangamoy|amoy|maamoy|nabubulok|naaagnas)\b/gi, negatable: true },
      { re: /\bbulok\s+na\s+(basura|pagkain|gulay|prutas|karne|isda)\b/gi, negatable: true },
      // pests
      { re: /\b(rats?|rodents?|mice|daga|ipis|cockroach\w*|roach\w*|mosquito\w*|lamok|langaw|flies|maggots?|uod|larva\w*|pests?|vermin|surot|pulgas|bedbugs?)\b/gi, negatable: true },
      // disease
      { re: /\b(dengue|leptospirosis|lepto|cholera|typhoid|diarrh\w*|hepatitis|malaria|diseases?|infect\w*|contagious|nakakahawa|outbreak|epidemic|sickness|illness)\b/gi, negatable: true },
      { re: /\b(sick|nagkasakit|nagkakasakit|magkasakit|maysakit|may\s+sakit)\b/gi, negatable: true },
      // health risk stated
      { re: /\bhealth\s+(risks?|hazards?|problems?|concerns?|issues?|threats?|effects?)\b/gi, negatable: true },
      { re: /\b(banta|panganib|peligro|epekto|pinsala|sakit|sira|masama|nakakasama|makasama|nakakasira)\s+(sa|para\s+sa)\s+kalusugan\b/gi, negatable: true },
      { re: /\b(unsanitary|insanitary|unhygienic|contaminat\w*|kontamina\w*|sewage|carcass|bangkay|patay\s+na\s+(hayop|aso|pusa|daga|baboy|manok|isda|ibon)|dead\s+(animals?|dogs?|cats?|rats?|pigs?|chickens?|fish|birds?))\b/gi, negatable: true },
      // smoke / breathing
      { re: /\b(smoke|usok|hirap\s+huminga|nahihirapan\s+huminga|difficulty\s+breathing|breathing\s+(problems?|difficulty)|respiratory)\b/gi, negatable: true },
    ],
  },
  // Only used to support "Low". Phrases are specific on purpose to avoid a false "Low".
  MINOR: {
    label: 'Citizen described the issue as minor',
    patterns: [
      {
        re: /\b(minor\s+(issue|problem|concern)|small\s+(amount|pile|issue|problem)|konti\s+lang|kaunti\s+lang|konting\s+basura|kaunting\s+basura|maliit\s+lang|maliit\s+na\s+(bagay|problema|tambak)|not\s+urgent|no\s+rush|can\s+wait|pwede(ng)?\s+maghintay|(hindi|di)\s+(naman\s+)?urgent|(hindi|di)\s+(naman\s+)?(gaanong\s+)?(malala|seryoso|delikado)|not\s+(that\s+)?serious|not\s+a\s+big\s+(deal|problem|issue))\b/gi,
        negatable: false,
      },
    ],
  },
};

const HAZARD_GROUP_IDS = ['SAFETY', 'ACCESS', 'WATER', 'HEALTH'];
const NEGATORS = /\b(no|not|without|never|walang|wala|hindi|di)\b/i;
const NEGATION_WINDOW = 25;
const MAX_EVIDENCE = 8;

const normalize = (text) =>
  String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

function findMatches(text, group) {
  const found = [];
  for (const { re, negatable } of group.patterns) {
    const regex = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m;
    while ((m = regex.exec(text)) !== null) {
      if (m[0].length === 0) {
        regex.lastIndex += 1;
        continue;
      }
      if (negatable) {
        const before = text.slice(Math.max(0, m.index - NEGATION_WINDOW), m.index);
        const clause = before.split(/[.!?;,\n]/).pop();
        if (NEGATORS.test(clause)) continue;
      }
      found.push(m[0].trim());
    }
  }
  return [...new Set(found)];
}

/**
 * Pure function: takes a report-like object, returns a recommendation.
 * Never changes the report and returns nothing about status or office.
 *
 * @returns {{ level: string, reason: string,
 *   indicators: { id: string, label: string, matched: string[] }[],
 *   rulesVersion: string }}
 */
export function suggestPriority(report) {
  const base = { rulesVersion: PRIORITY_RULES_VERSION };
  const text = normalize(report?.description);

  if (!text) {
    return {
      ...base,
      level: PRIORITY_LEVELS.NEEDS_ASSESSMENT,
      reason: 'No description available to assess.',
      indicators: [],
    };
  }

  const indicators = Object.entries(INDICATOR_GROUPS)
    .map(([id, group]) => ({ id, label: group.label, matched: findMatches(text, group).slice(0, MAX_EVIDENCE) }))
    .filter((g) => g.matched.length > 0);

  const hazards = indicators.filter((g) => HAZARD_GROUP_IDS.includes(g.id));
  const hasMinor = indicators.some((g) => g.id === 'MINOR');
  const hasSafety = hazards.some((g) => g.id === 'SAFETY');

  const result = (level, reason) => ({ ...base, level, reason, indicators });

  if (hasMinor && hazards.length > 0) {
    return result(
      PRIORITY_LEVELS.NEEDS_ASSESSMENT,
      'The description contains conflicting statements (described as minor, but also mentions a hazard).'
    );
  }
  if (hasMinor) {
    return result(PRIORITY_LEVELS.LOW, 'The citizen described the issue as minor and stated no hazard.');
  }
  if (hasSafety && hazards.length >= 2) {
    return result(PRIORITY_LEVELS.CRITICAL, 'A possible safety hazard and another impact were both stated.');
  }
  if (hasSafety) {
    return result(PRIORITY_LEVELS.HIGH, 'A possible safety hazard was stated.');
  }
  if (hazards.length >= 2) {
    return result(PRIORITY_LEVELS.HIGH, 'Two or more different impacts were stated.');
  }
  if (hazards.length === 1) {
    return result(PRIORITY_LEVELS.MEDIUM, 'One impact was stated in the description.');
  }
  return result(
    PRIORITY_LEVELS.NEEDS_ASSESSMENT,
    'The description does not state enough to recommend a level. Please assess using the photos and details.'
  );
}

export const PRIORITY_DISCLAIMER =
  'Suggested by the system from the citizen\u2019s description only. Proposed levels \u2014 not an official EMB, CENRO or City Engineering classification. Photos, location and submission time are not used. The office decides which reports to address first.';