import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const UID = {
  master: 'bfzHl9qWXRRkCR80DPGz28q9IT22',
  cenro: 'B3J7uDmuSSZCbEMiYUG32wfjKM12',
  ce: '9kILBscCUzPN0YDkAcKFdUJMrK42',
  emb: 'GHH7TT2o35YyPHXkK3cZJRiatl63',
  nobody: 'randomNonAdminUid00000000001',
  inactive: 'inactiveCenroAdminUid000001',
  suspendedMaster: 'suspendedMasterAdminUid0001',
};

const R = {
  cenro: 'fmaugRsn25Kkfn5XFgLA', // CENRO, Approved
  ce: '35KphcnXTBMyCu3H2Cuw', // City Engineering, Approved
  cenroOngoing: 'testCenroOngoing',
  cenroResolved: 'testCenroResolved',
  cenroPending: 'testCenroPending',
  cenroRejected: 'testCenroRejected',
  supportOnly: 'testCeSupportCenro', // primary City Engineering, CENRO only supporting
  rerouteTarget: 'testCeRerouteCenro', // primary City Engineering, CENRO only reroute target
};

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';
const ts = () => firebase.firestore.FieldValue.serverTimestamp();
const photo = (uid, office, extra = {}) => ({
  data: JPEG,
  uploadedByUid: uid,
  uploadedByOffice: office,
  uploadedAt: ts(),
  ...extra,
});
const ref = (db, report, slot) => db.doc(`reports/${report}/responsePhotos/${slot}`);

const updRef = (db, report, id) => db.doc(`reports/${report}/responseUpdates/${id}`);
const upd = (uid, office, extra = {}) => ({
  message: 'Cleared the area.',
  uploadedByUid: uid,
  uploadedByOffice: office,
  createdAt: ts(),
  ...extra,
});

const testEnv = await initializeTestEnvironment({
  projectId: 'cityecomap',
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
  },
});

async function seed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`admins/${UID.master}`).set({ role: 'Master Admin', status: 'Active' });
    await db.doc(`admins/${UID.cenro}`).set({ role: 'CENRO Admin', status: 'Active' });
    await db.doc(`admins/${UID.ce}`).set({ role: 'City Engineering Admin', status: 'Active' });
    await db.doc(`admins/${UID.emb}`).set({ role: 'EMB Admin', status: 'Active' });
    await db.doc(`admins/${UID.inactive}`).set({ role: 'CENRO Admin', status: 'Inactive' });
    await db.doc(`admins/${UID.suspendedMaster}`).set({ role: 'Master Admin', status: 'Suspended' });

    await db.doc(`reports/${R.cenro}`).set({ status: 'Approved', primaryOffice: 'CENRO' });
    await db.doc(`reports/${R.ce}`).set({ status: 'Approved', primaryOffice: 'City Engineering' });
    await db.doc(`reports/${R.cenroOngoing}`).set({ status: 'Ongoing', primaryOffice: 'CENRO' });
    await db.doc(`reports/${R.cenroResolved}`).set({ status: 'Resolved', primaryOffice: 'CENRO' });
    await db.doc(`reports/${R.cenroPending}`).set({ status: 'Pending', primaryOffice: 'CENRO' });
    await db.doc(`reports/${R.cenroRejected}`).set({ status: 'Rejected', primaryOffice: 'CENRO' });
    await db.doc(`reports/${R.supportOnly}`).set({
      status: 'Approved',
      primaryOffice: 'City Engineering',
      supportingOffices: [{ officeId: 'CENRO', status: 'accepted' }],
      supportingOfficeIds: ['CENRO'],
    });
    await db.doc(`reports/${R.rerouteTarget}`).set({
      status: 'Approved',
      primaryOffice: 'City Engineering',
      jurisdictionCandidates: ['CENRO'],
      rerouteRequest: { targetOffice: 'CENRO' },
    });

    // Existing photo in slot 1 (used by delete / duplicate / limit tests)
    for (const [rep, uid, office] of [
      [R.cenro, UID.cenro, 'CENRO'],
      [R.ce, UID.ce, 'City Engineering'],
      [R.cenroPending, UID.cenro, 'CENRO'],
      [R.cenroRejected, UID.cenro, 'CENRO'],
      [R.supportOnly, UID.ce, 'City Engineering'],
      [R.rerouteTarget, UID.ce, 'City Engineering'],
    ]) {
      await ref(db, rep, '1').set(photo(uid, office, { uploadedAt: new Date() }));
    }
    for (const [rep, uid, office] of [
      [R.cenro, UID.cenro, 'CENRO'],
      [R.ce, UID.ce, 'City Engineering'],
      [R.supportOnly, UID.ce, 'City Engineering'],
    ]) {
      await updRef(db, rep, 'u1').set({ message: 'Existing update', uploadedByUid: uid, uploadedByOffice: office, createdAt: new Date() });
    }
  });
}

const ctxs = () => ({
  master: testEnv.authenticatedContext(UID.master).firestore(),
  cenro: testEnv.authenticatedContext(UID.cenro).firestore(),
  ce: testEnv.authenticatedContext(UID.ce).firestore(),
  emb: testEnv.authenticatedContext(UID.emb).firestore(),
  nobody: testEnv.authenticatedContext(UID.nobody).firestore(),
  inactive: testEnv.authenticatedContext(UID.inactive).firestore(),
  suspendedMaster: testEnv.authenticatedContext(UID.suspendedMaster).firestore(),
  anon: testEnv.unauthenticatedContext().firestore(),
});

const OK = (p) => assertSucceeds(p);
const NO = (p) => assertFails(p);

const tests = [
  // ---------- allowed ----------
  ['ALLOW', 'Master uploads to a City Engineering report', (c) => OK(ref(c.master, R.ce, '2').set(photo(UID.master, 'EMB')))],
  ['ALLOW', 'Master uploads to a CENRO report', (c) => OK(ref(c.master, R.cenro, '2').set(photo(UID.master, 'EMB')))],
  ['ALLOW', 'CENRO uploads to its own Approved report', (c) => OK(ref(c.cenro, R.cenro, '2').set(photo(UID.cenro, 'CENRO')))],
  ['ALLOW', 'CENRO uploads to its own Ongoing report', (c) => OK(ref(c.cenro, R.cenroOngoing, '1').set(photo(UID.cenro, 'CENRO')))],
  ['ALLOW', 'CENRO uploads to its own Resolved report', (c) => OK(ref(c.cenro, R.cenroResolved, '1').set(photo(UID.cenro, 'CENRO')))],
  ['ALLOW', 'City Engineering uploads to its own Approved report', (c) => OK(ref(c.ce, R.ce, '2').set(photo(UID.ce, 'City Engineering')))],
  ['ALLOW', 'Anyone (not logged in) can read response photos', (c) => OK(c.anon.collection(`reports/${R.cenro}/responsePhotos`).get())],
  ['ALLOW', 'Master deletes a photo on any report', (c) => OK(ref(c.master, R.ce, '1').delete())],
  ['ALLOW', 'CENRO deletes a photo on its own report', (c) => OK(ref(c.cenro, R.cenro, '1').delete())],
  ['ALLOW', 'CENRO deletes a photo on its own Pending report (any status)', (c) => OK(ref(c.cenro, R.cenroPending, '1').delete())],
  ['ALLOW', 'CENRO deletes a photo on its own Rejected report (any status)', (c) => OK(ref(c.cenro, R.cenroRejected, '1').delete())],

  // ---------- denied: wrong office / no permission ----------
  ['DENY', 'CENRO cannot upload to a City Engineering report', (c) => NO(ref(c.cenro, R.ce, '2').set(photo(UID.cenro, 'CENRO')))],
  ['DENY', 'City Engineering cannot upload to a CENRO report', (c) => NO(ref(c.ce, R.cenro, '2').set(photo(UID.ce, 'City Engineering')))],
  ['DENY', 'CENRO cannot delete a photo on a City Engineering report', (c) => NO(ref(c.cenro, R.ce, '1').delete())],
  ['DENY', 'City Engineering cannot delete a photo on a CENRO report', (c) => NO(ref(c.ce, R.cenro, '1').delete())],
  ['DENY', 'Not logged in cannot upload', (c) => NO(ref(c.anon, R.cenro, '2').set(photo(UID.cenro, 'CENRO')))],
  ['DENY', 'Not logged in cannot delete', (c) => NO(ref(c.anon, R.cenro, '1').delete())],
  ['DENY', 'Signed-in non-admin cannot upload', (c) => NO(ref(c.nobody, R.cenro, '2').set(photo(UID.nobody, 'CENRO')))],
  ['DENY', 'Signed-in non-admin cannot delete', (c) => NO(ref(c.nobody, R.cenro, '1').delete())],
  ['DENY', 'EMB Admin (monitoring only) cannot upload', (c) => NO(ref(c.emb, R.cenro, '2').set(photo(UID.emb, 'EMB')))],
  ['DENY', 'EMB Admin (monitoring only) cannot delete', (c) => NO(ref(c.emb, R.cenro, '1').delete())],

  // ---------- denied: status ----------
  ['DENY', 'CENRO cannot upload to its own Pending report', (c) => NO(ref(c.cenro, R.cenroPending, '2').set(photo(UID.cenro, 'CENRO')))],
  ['DENY', 'CENRO cannot upload to its own Rejected report', (c) => NO(ref(c.cenro, R.cenroRejected, '2').set(photo(UID.cenro, 'CENRO')))],

  // ---------- denied: no update / tampering / limits ----------
  ['DENY', 'Cannot update an existing photo (create-only)', (c) => NO(ref(c.cenro, R.cenro, '1').set(photo(UID.cenro, 'CENRO')))],
  ['DENY', 'Cannot update an existing photo with update()', (c) => NO(ref(c.cenro, R.cenro, '1').update({ data: JPEG + 'AA' }))],
  ['DENY', 'Cannot fake uploadedByUid', (c) => NO(ref(c.cenro, R.cenro, '2').set(photo(UID.ce, 'CENRO')))],
  ['DENY', 'Cannot fake uploadedByOffice', (c) => NO(ref(c.cenro, R.cenro, '2').set(photo(UID.cenro, 'City Engineering')))],
  ['DENY', 'Cannot use a client-side timestamp for uploadedAt', (c) => NO(ref(c.cenro, R.cenro, '2').set(photo(UID.cenro, 'CENRO', { uploadedAt: new Date() })))],
  ['DENY', 'Cannot add extra fields', (c) => NO(ref(c.cenro, R.cenro, '2').set(photo(UID.cenro, 'CENRO', { extra: 'x' })))],
  ['DENY', 'Cannot upload a non-JPEG data URL', (c) => NO(ref(c.cenro, R.cenro, '2').set(photo(UID.cenro, 'CENRO', { data: 'data:image/png;base64,AAAA' })))],
  ['DENY', 'Cannot upload data larger than the limit', (c) => NO(ref(c.cenro, R.cenro, '2').set(photo(UID.cenro, 'CENRO', { data: 'data:image/jpeg;base64,' + 'A'.repeat(450000) })))],
  ['DENY', 'Cannot use slot 6', (c) => NO(ref(c.cenro, R.cenro, '6').set(photo(UID.cenro, 'CENRO')))],
  ['DENY', 'Cannot use slot 0', (c) => NO(ref(c.cenro, R.cenro, '0').set(photo(UID.cenro, 'CENRO')))],
  ['DENY', 'Cannot use a free-form slot id', (c) => NO(ref(c.cenro, R.cenro, 'abc').set(photo(UID.cenro, 'CENRO')))],

  // ---------- denied: inactive / suspended admin accounts ----------
  ['DENY', 'Inactive CENRO admin cannot upload to its own office report', (c) => NO(ref(c.inactive, R.cenro, '2').set(photo(UID.inactive, 'CENRO')))],
  ['DENY', 'Inactive CENRO admin cannot delete a photo on its own office report', (c) => NO(ref(c.inactive, R.cenro, '1').delete())],
  ['DENY', 'Suspended Master Admin cannot upload', (c) => NO(ref(c.suspendedMaster, R.cenro, '2').set(photo(UID.suspendedMaster, 'EMB')))],
  ['DENY', 'Suspended Master Admin cannot delete a photo', (c) => NO(ref(c.suspendedMaster, R.cenro, '1').delete())],

  // ---------- denied: CENRO is only a supporting office / reroute target ----------
  ['ALLOW', 'Control: City Engineering (primary) uploads to the report CENRO only supports', (c) => OK(ref(c.ce, R.supportOnly, '2').set(photo(UID.ce, 'City Engineering')))],
  ['DENY', 'CENRO (supporting office only) cannot upload', (c) => NO(ref(c.cenro, R.supportOnly, '2').set(photo(UID.cenro, 'CENRO')))],
  ['DENY', 'CENRO (supporting office only) cannot delete a photo', (c) => NO(ref(c.cenro, R.supportOnly, '1').delete())],
  ['DENY', 'CENRO (reroute target / jurisdiction candidate only) cannot upload', (c) => NO(ref(c.cenro, R.rerouteTarget, '2').set(photo(UID.cenro, 'CENRO')))],
  ['DENY', 'CENRO (reroute target / jurisdiction candidate only) cannot delete a photo', (c) => NO(ref(c.cenro, R.rerouteTarget, '1').delete())],
  [
    'LIMIT',
    'Max 5: slots 2-5 succeed (slot 1 already used), then slot 1 again and slot 6 are denied',
    async (c) => {
      for (const s of ['2', '3', '4', '5']) {
        await OK(ref(c.cenro, R.cenro, s).set(photo(UID.cenro, 'CENRO')));
      }
      await NO(ref(c.cenro, R.cenro, '1').set(photo(UID.cenro, 'CENRO')));
      await NO(ref(c.cenro, R.cenro, '6').set(photo(UID.cenro, 'CENRO')));
    },
  ],
  [
    'LIMIT',
    'Same slot twice (simulated concurrent upload): second create is denied',
    async (c) => {
      await OK(ref(c.cenro, R.cenro, '3').set(photo(UID.cenro, 'CENRO')));
      await NO(ref(c.master, R.cenro, '3').set(photo(UID.master, 'EMB')));
    },
  ],

  // ---------- response updates (message) ----------
  ['ALLOW', 'CENRO creates an update with a message on its own Approved report', (c) => OK(updRef(c.cenro, R.cenro, 'n1').set(upd(UID.cenro, 'CENRO')))],
  ['ALLOW', 'CENRO creates an update with an empty message (photos only)', (c) => OK(updRef(c.cenro, R.cenro, 'n1').set(upd(UID.cenro, 'CENRO', { message: '' })))],
  ['ALLOW', 'CENRO uploads a photo linked to an update (updateId)', (c) => OK(ref(c.cenro, R.cenro, '2').set(photo(UID.cenro, 'CENRO', { updateId: 'u1' })))],
  ['ALLOW', 'Message-only update (no photos) is allowed', (c) => OK(updRef(c.ce, R.ce, 'n1').set(upd(UID.ce, 'City Engineering')))],
  ['ALLOW', 'CENRO creates an update on its own Ongoing report (late documentation)', (c) => OK(updRef(c.cenro, R.cenroOngoing, 'n1').set(upd(UID.cenro, 'CENRO')))],
  ['ALLOW', 'CENRO creates an update on its own Resolved report (late documentation)', (c) => OK(updRef(c.cenro, R.cenroResolved, 'n1').set(upd(UID.cenro, 'CENRO')))],
  ['ALLOW', 'Master creates an update (same as existing photo permission)', (c) => OK(updRef(c.master, R.ce, 'n1').set(upd(UID.master, 'EMB')))],
  ['ALLOW', 'Anyone (not logged in) can read response updates', (c) => OK(c.anon.collection(`reports/${R.cenro}/responseUpdates`).get())],
  ['ALLOW', 'CENRO deletes an update on its own report', (c) => OK(updRef(c.cenro, R.cenro, 'u1').delete())],
  ['ALLOW', 'Master deletes an update (same as existing photo permission)', (c) => OK(updRef(c.master, R.ce, 'u1').delete())],

  ['DENY', 'CENRO cannot create an update on a City Engineering report', (c) => NO(updRef(c.cenro, R.ce, 'n1').set(upd(UID.cenro, 'CENRO')))],
  ['DENY', 'City Engineering cannot create an update on a CENRO report', (c) => NO(updRef(c.ce, R.cenro, 'n1').set(upd(UID.ce, 'City Engineering')))],
  ['DENY', 'CENRO cannot delete an update on a City Engineering report', (c) => NO(updRef(c.cenro, R.ce, 'u1').delete())],
  ['DENY', 'EMB Admin cannot create an update', (c) => NO(updRef(c.emb, R.cenro, 'n1').set(upd(UID.emb, 'EMB')))],
  ['DENY', 'EMB Admin cannot delete an update', (c) => NO(updRef(c.emb, R.cenro, 'u1').delete())],
  ['DENY', 'Not logged in cannot create an update', (c) => NO(updRef(c.anon, R.cenro, 'n1').set(upd(UID.cenro, 'CENRO')))],
  ['DENY', 'Not logged in cannot delete an update', (c) => NO(updRef(c.anon, R.cenro, 'u1').delete())],
  ['DENY', 'Signed-in non-admin cannot create an update', (c) => NO(updRef(c.nobody, R.cenro, 'n1').set(upd(UID.nobody, 'CENRO')))],
  ['DENY', 'Signed-in non-admin cannot delete an update', (c) => NO(updRef(c.nobody, R.cenro, 'u1').delete())],
  ['DENY', 'Inactive CENRO admin cannot create an update', (c) => NO(updRef(c.inactive, R.cenro, 'n1').set(upd(UID.inactive, 'CENRO')))],
  ['DENY', 'CENRO (supporting office only) cannot create an update', (c) => NO(updRef(c.cenro, R.supportOnly, 'n1').set(upd(UID.cenro, 'CENRO')))],
  ['DENY', 'CENRO (supporting office only) cannot delete an update', (c) => NO(updRef(c.cenro, R.supportOnly, 'u1').delete())],
  ['DENY', 'CENRO cannot create an update on its own Pending report', (c) => NO(updRef(c.cenro, R.cenroPending, 'n1').set(upd(UID.cenro, 'CENRO')))],
  ['DENY', 'CENRO cannot create an update on its own Rejected report', (c) => NO(updRef(c.cenro, R.cenroRejected, 'n1').set(upd(UID.cenro, 'CENRO')))],
  ['DENY', 'Cannot edit an existing update (create-only)', (c) => NO(updRef(c.cenro, R.cenro, 'u1').update({ message: 'changed' }))],
  ['DENY', 'Cannot overwrite an existing update with set()', (c) => NO(updRef(c.cenro, R.cenro, 'u1').set(upd(UID.cenro, 'CENRO')))],
  ['DENY', 'Cannot fake uploadedByUid on an update', (c) => NO(updRef(c.cenro, R.cenro, 'n1').set(upd(UID.ce, 'CENRO')))],
  ['DENY', 'Cannot fake uploadedByOffice on an update', (c) => NO(updRef(c.cenro, R.cenro, 'n1').set(upd(UID.cenro, 'City Engineering')))],
  ['DENY', 'Cannot use a client-side timestamp for createdAt', (c) => NO(updRef(c.cenro, R.cenro, 'n1').set(upd(UID.cenro, 'CENRO', { createdAt: new Date() })))],
  ['DENY', 'Cannot add extra fields to an update', (c) => NO(updRef(c.cenro, R.cenro, 'n1').set(upd(UID.cenro, 'CENRO', { extra: 'x' })))],
  ['DENY', 'Message longer than 1000 characters is rejected', (c) => NO(updRef(c.cenro, R.cenro, 'n1').set(upd(UID.cenro, 'CENRO', { message: 'a'.repeat(1001) })))],
  ['DENY', 'Message must be a string', (c) => NO(updRef(c.cenro, R.cenro, 'n1').set(upd(UID.cenro, 'CENRO', { message: 123 })))],
  ['DENY', 'Photo updateId must be a string', (c) => NO(ref(c.cenro, R.cenro, '2').set(photo(UID.cenro, 'CENRO', { updateId: 123 })))],
  ['DENY', 'Photo updateId longer than 40 characters is rejected', (c) => NO(ref(c.cenro, R.cenro, '2').set(photo(UID.cenro, 'CENRO', { updateId: 'x'.repeat(41) })))],
];

let failed = 0;
for (const [kind, name, fn] of tests) {
  await seed();
  try {
    await fn(ctxs());
    console.log(`PASS  [${kind}] ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  [${kind}] ${name}\n        ${String(e.message).split('\n')[0]}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
await testEnv.cleanup();
process.exit(failed ? 1 : 0);
