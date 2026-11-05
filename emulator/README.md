# Response Photos: Rules Tests and Known Limitations

Local-only documentation. The Firestore rules are edited in the Firebase Console (the repo is hosting-only); `emulator/firestore.rules` is a copy of the production rules plus the `// NEW` response-photo blocks, used for emulator testing.

## Run the rules tests

```
firebase emulators:start --config firebase.emulator.json --only auth,firestore
```
Then, in a second terminal:
```
cd emulator\tests
npm install
node rules.test.mjs
```
Never run the app with `REACT_APP_USE_EMULATOR=true` for a production build.

## Known limitations

1. **Public read.** `reports/{id}/responsePhotos/*` is publicly readable so that the reporter can see the office's photos in Track Report. Admins are warned in the UI not to upload photos showing faces, plate numbers, or private information.
2. **Citizen name and email are exposed in public report documents.** This is a separate, pre-existing privacy issue. It needs its own privacy phase and is not solved by this feature.
3. **Orphan response photos.** If a Master Admin deletes a parent report, its `responsePhotos` subcollection is not deleted automatically. Parent-report deletion cleanup is a separate future task.
4. **Storage.** Photos are base64 JPEG in Firestore (about 330 KB max each, 5 per report). Each Track Report search reads up to 5 extra documents.
5. No statusHistory entry and no citizen notification when a photo is uploaded.
6. Response photos are not included in PDF/Excel exports.
7. EXIF/GPS stripping was verified in Chrome only. Safari, Firefox, and iPhone/HEIC photos are untested.