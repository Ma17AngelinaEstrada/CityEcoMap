import { PRIORITY_LEVELS as L, suggestPriority } from './priorityRules';

const report = (description, extra = {}) => ({
  category: 'Waste Issue',
  subCategory: 'Illegal Dumping',
  areaType: 'Road',
  status: 'Pending',
  primaryOffice: 'CENRO',
  supportingOffices: [],
  description,
  ...extra,
});

test('one stated impact -> Medium, with the matched phrase', () => {
  const r = suggestPriority(report('May baha tuwing umuulan sa tapat ng paaralan'));
  expect(r.level).toBe(L.MEDIUM);
  expect(r.indicators[0].matched).toContain('baha');
});

test('two impacts -> High; safety hazard alone -> High; hazard plus impact -> Critical; minor -> Low', () => {
  expect(suggestPriority(report('Umaapaw ang kanal at nakaharang sa kalsada ang basura')).level).toBe(L.HIGH);
  expect(suggestPriority(report('Bukas na manhole sa gilid ng daan')).level).toBe(L.HIGH);
  expect(suggestPriority(report('Open manhole and the street is flooded')).level).toBe(L.CRITICAL);
  expect(suggestPriority(report('Konti lang naman, not urgent')).level).toBe(L.LOW);
});

test.each([
  ['empty', ''],
  ['missing', undefined],
  ['vague text', 'May tambak ng basura dito'],
  ['"bahay" is not "baha"', 'Sa tapat ng bahay namin may basura'],
  ['negated', 'Walang baha dito'],
  ['conflicting', 'Maliit lang pero may baha at mabaho'],
])('%s -> Needs Assessment', (_n, description) => {
  expect(suggestPriority(report(description)).level).toBe(L.NEEDS_ASSESSMENT);
});

test('works for old reports and null input without throwing', () => {
  expect(suggestPriority({ reportId: 'WIOLD01', description: 'May baha' }).level).toBe(L.MEDIUM);
  expect(suggestPriority(null).level).toBe(L.NEEDS_ASSESSMENT);
});

test('status, office, escalation, category, area, age and location never change the level', () => {
  const text = 'Umaapaw ang kanal at nakaharang sa kalsada';
  const base = suggestPriority(report(text)).level;
  [
    { status: 'Ongoing', primaryOffice: 'City Engineering' },
    { supportingOffices: [{ id: 'x', officeId: 'EMB', status: 'pending' }], escalation: { status: 'open' }, rerouteCount: 3 },
    { category: 'Drainage Issue', subCategory: 'Flooding', areaType: 'Bridge' },
    { createdAt: { toDate: () => new Date('2026-01-01') }, location: { lat: 13.9, lng: 121.6 } },
  ].forEach((v) => expect(suggestPriority(report(text, v)).level).toBe(base));
});

test('does not modify the report it is given', () => {
  const r = report('Umaapaw ang kanal', { supportingOffices: [{ id: 's', officeId: 'EMB' }] });
  const copy = JSON.parse(JSON.stringify(r));
  suggestPriority(r);
  expect(JSON.parse(JSON.stringify(r))).toEqual(copy);
});

describe('v2 expanded Tagalog/English risk words', () => {
  const level = (description) => suggestPriority({ description }).level;

  test.each([
    // Medium: isang uri lang ng hazard
    ['Nakaharang sa kalsada ang basura', L.MEDIUM],
    ['Baha hanggang tuhod', L.MEDIUM],
    ['Napakabaho ng kanal', L.MEDIUM],
    ['Maraming daga at lamok', L.MEDIUM],
    ['Hindi madaanan ang daan', L.MEDIUM],
    ['May dengue sa lugar', L.MEDIUM],
    // High: safety lang, o dalawang uri
    ['Delikado po dito', L.HIGH],
    ['May bubog sa daan, delikado', L.HIGH],
    ['This is dangerous for kids', L.HIGH],
    ['May nahulog sa kanal', L.HIGH],
    ['Open manhole near school', L.HIGH],
    ['Walang takip ang drainage', L.HIGH],
    ['Nasusunog ang basura', L.HIGH],
    ['Mabaho at baha sa kalsada', L.HIGH],
    // Critical: safety + isa pang hazard
    ['Malakas ang baha at delikado', L.CRITICAL],
    ['Napakabaho at delikado sa mga bata ang mga basura', L.CRITICAL],
    // Low: sinabi mismo ng citizen
    ['Maliit lang na tambak', L.LOW],
    ['Minor issue only', L.LOW],
    ['Hindi delikado', L.LOW],
    // Needs Assessment: negation, conflict, o hindi sapat
    ['Walang baha dito', L.NEEDS_ASSESSMENT],
    ['No danger here', L.NEEDS_ASSESSMENT],
    ['Maliit lang pero may baha at mabaho', L.NEEDS_ASSESSMENT],
    ['Bahay namin sa tabi', L.NEEDS_ASSESSMENT],
    ['Bahagi ng kalsada', L.NEEDS_ASSESSMENT],
    ['Near the fire station', L.NEEDS_ASSESSMENT],
    ['Fire hydrant broken', L.NEEDS_ASSESSMENT],
    ['Basura sa kanto', L.NEEDS_ASSESSMENT],
    ['Barado ang kanal', L.NEEDS_ASSESSMENT],
    ['Tambak ng basura', L.NEEDS_ASSESSMENT],
    ['Urgent po', L.NEEDS_ASSESSMENT],
    ['Polluted ang ilog', L.NEEDS_ASSESSMENT],
    ['Hindi dumadaloy ng maayos sa kanal', L.NEEDS_ASSESSMENT],
    ['aaaa', L.NEEDS_ASSESSMENT],
  ])('%s -> %s', (description, expected) => {
    expect(level(description)).toBe(expected);
  });
});