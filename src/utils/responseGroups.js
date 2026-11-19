// Groups response photos with their response update (message, office, time).
// Photos saved before this feature have no updateId; they are grouped per office
// ("legacy" groups) so old records stay visible, just without a message.
const toMs = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : 0);

export function buildResponseGroups(updates = [], photos = []) {
  const byId = new Map();
  updates.forEach((u) => {
    byId.set(u.id, {
      key: u.id,
      updateId: u.id,
      office: u.uploadedByOffice || null,
      message: (u.message || "").trim(),
      at: u.createdAt || null,
      photos: [],
    });
  });

  const legacy = new Map();
  photos.forEach((p) => {
    const g = p.updateId ? byId.get(p.updateId) : null;
    if (g) {
      g.photos.push(p);
      return;
    }
    const key = `legacy-${p.uploadedByOffice || "unknown"}`;
    if (!legacy.has(key)) {
      legacy.set(key, {
        key,
        updateId: null,
        office: p.uploadedByOffice || null,
        message: "",
        at: p.uploadedAt || null,
        photos: [],
      });
    }
    const lg = legacy.get(key);
    lg.photos.push(p);
    if (p.uploadedAt && (!lg.at || toMs(p.uploadedAt) < toMs(lg.at))) lg.at = p.uploadedAt;
  });

  // Newest first. Updates with neither a message nor photos are hidden.
  return [...byId.values(), ...legacy.values()]
    .filter((g) => g.message || g.photos.length > 0)
    .sort((a, b) => toMs(b.at) - toMs(a.at));
}

export function responseOfficeLabel(office, report, nameOf) {
  if (!office) return "Handling office";
  const name = nameOf ? nameOf(office) : office;
  if (report && office === report.primaryOffice) return `${name} (Primary Office)`;
  if (report && (report.supportingOfficeIds || []).includes(office)) return `${name} (Supporting Office)`;
  return name;
}