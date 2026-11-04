// DEV ONLY: fake data for `npm run mock`. Mirrors the seed (02_seed.sql), the status
// trigger (01_schema.sql §5) and the v2 rules (04_update_v2.sql: PIC, content_targets,
// banners) closely enough for visual and interaction QA.
import { addDays, currentMonthWIB, daysInMonth, monthStart, shiftMonth, todayWIB } from '../../lib/time.js';

export const ROLES = [
  { id: 'admin', name: 'Admin', is_admin: true, layout: null, sort_order: 0 },
  { id: 'lahap_makmoer', name: 'Lahap & Kedai Makmoer 88', is_admin: false, layout: 'multi_brand', sort_order: 10 },
  { id: 'beefix', name: 'Beefix', is_admin: false, layout: 'single', sort_order: 20 },
  { id: 'homy8', name: 'Homy8', is_admin: false, layout: 'single', sort_order: 30 },
  { id: 'behomy', name: 'Behomy', is_admin: false, layout: 'team', sort_order: 40 },
];

export const BRANDS = [
  { id: 'lahap', name: 'Lahap', instagram_handle: 'eatlahap', sort_order: 10 },
  { id: 'kedai_makmoer_88', name: 'Kedai Makmoer 88', instagram_handle: 'kedaimakmoer88', sort_order: 20 },
  { id: 'beefix', name: 'Beefix', instagram_handle: 'beefix.id', sort_order: 30 },
  { id: 'homy8', name: 'Homy8', instagram_handle: 'homyeight', sort_order: 40 },
  { id: 'behomy', name: 'Behomy', instagram_handle: 'behomyid', sort_order: 50 },
  { id: 'behomy_group', name: 'Behomy Group', instagram_handle: 'behomygroup', sort_order: 51 },
  { id: 'corvel', name: 'Corvel', instagram_handle: 'corvel.bybehomy', sort_order: 52 },
  { id: 'hoteru', name: 'Hoteru', instagram_handle: 'hote_ru', sort_order: 53 },
  { id: 'purnava', name: 'Purnava', instagram_handle: 'purnava.bybehomy', sort_order: 54 },
];

export const ROLE_BRANDS = [
  ['lahap_makmoer', 'lahap'],
  ['lahap_makmoer', 'kedai_makmoer_88'],
  ['beefix', 'beefix'],
  ['homy8', 'homy8'],
  ['behomy', 'behomy'],
  ['behomy', 'behomy_group'],
  ['behomy', 'corvel'],
  ['behomy', 'hoteru'],
  ['behomy', 'purnava'],
].map(([role_id, brand_id]) => ({ role_id, brand_id }));

export const PILLARS = ['Design', 'Education', 'Portfolio', 'Interview', 'Comedy'].map((name, i) => ({
  brand_id: 'homy8',
  name,
  sort_order: i + 1,
}));

export const PEOPLE = [
  { id: 'u-admin', email: 'admin@beyondcy.co', display_name: 'Admin Beyondcy', role_id: 'admin', is_active: true },
  { id: 'u-excel', email: 'excel@beyondcy.co', display_name: 'Excel', role_id: 'lahap_makmoer', is_active: true },
  { id: 'u-dika', email: 'dika@beyondcy.co', display_name: 'Dika', role_id: 'beefix', is_active: true },
  { id: 'u-zaki', email: 'zaki@beyondcy.co', display_name: 'Zaki', role_id: 'homy8', is_active: true },
  { id: 'u-arum', email: 'arum@beyondcy.co', display_name: 'Arum', role_id: 'behomy', is_active: true },
  { id: 'u-ilyas', email: 'ilyas@beyondcy.co', display_name: 'Ilyas', role_id: 'behomy', is_active: true },
  { id: 'u-anne', email: 'anne@beyondcy.co', display_name: 'Anne', role_id: 'behomy', is_active: true },
  { id: 'u-rina', email: 'rina.new@beyondcy.co', display_name: 'rina.new', role_id: null, is_active: true },
  { id: 'u-bagas', email: 'bagas@beyondcy.co', display_name: 'Bagas', role_id: 'beefix', is_active: false },
].map((p) => ({ ...p, created_at: '2026-10-01T02:00:00Z' }));

const TITLES = [
  'Promo bundling akhir bulan',
  'Behind the scene dapur',
  'Menu baru: nasi bakar cakalang',
  'Tips merawat sofa kulit',
  'Before–after renovasi dapur mungil di Bintaro',
  'Testimoni pelanggan setia',
  'Giveaway 10.000 followers',
  'Resep sambal matah ala rumah',
  'Kolaborasi dengan kreator lokal',
  'Q&A bareng arsitek interior',
  'Tur showroom baru',
  'Highlight event weekend',
  'Interview tukang kayu senior',
  'Meme Senin pagi',
  'Carousel 5 ide ruang kerja',
  'Reels proses produksi',
  'Hari Pahlawan: cerita tim',
  'Flash sale 11.11',
  'Daftar menu catering kantor',
  'Video ASMR potong sayur',
];
const BRIEF = 'Fokus ke manfaat utama, tone hangat dan santai. Tampilkan produk di 3 detik pertama.';
const CAPTION =
  'Siapa yang sudah coba? Datang langsung ke outlet terdekat dan rasakan sendiri. Promo berlaku sampai akhir bulan, jangan sampai kelewatan ya! #kulinerjakarta #promoakhirbulan';
const NOTES = 'Shooting Kamis pagi, talent dari tim internal. Cek ulang harga sebelum posting.';
const REFERENCE = 'https://pin.it/3xAmPle\nhttps://maps.app.goo.gl/ContohLokasi';

let seq = 0;
export const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${(seq += 1)}`);
const nowIso = () => new Date().toISOString();
/** 'YYYY-MM-DD' at hh:mm WIB → ISO timestamp */
const wib = (date, hh = 9, mm = 0) => new Date(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`).toISOString();

const REQUIRED = ['content', 'type', 'brief', 'caption', 'notes', 'publish_date', 'reference'];
const TEXT = ['content', 'brief', 'caption', 'notes', 'reference', 'instagram_url'];

/** The tracker's only active person, or null when there are several (Behomy). */
export function singleMember(store, roleId) {
  const members = store.people.filter((p) => p.role_id === roleId && p.is_active);
  return members.length === 1 ? members[0].id : null;
}

/**
 * Mirror of content_items_before_write() (v2). Returns { row } or { error }.
 * `actor` is the signed-in person (null for fixtures, like the SQL editor).
 */
export function computeItem(store, input, old, actor) {
  const r = { ...input };
  const isAdmin = actor?.role_id === 'admin' && actor.is_active;
  if (actor && !isAdmin && actor.role_id !== r.role_id) return { error: "You don't have access to this tracker." };

  // PIC: staff = themselves; Admin = the tracker's only person, or chosen (Behomy)
  if (!old) {
    if (isAdmin) {
      r.pic_id = r.pic_id ?? singleMember(store, r.role_id);
      if (!r.pic_id) return { error: 'Choose the PIC for this content.' };
    } else if (actor) {
      r.pic_id = actor.id;
    } else if (r.pic_id === undefined) {
      r.pic_id = r.owner_id; // fixtures: an explicit null stays null ("Needs a PIC")
    }
  } else if (actor && !isAdmin) {
    r.pic_id = old.pic_id; // only Admin can change the PIC
  } else if (isAdmin && r.pic_id == null && old.pic_id != null) {
    return { error: 'Choose the PIC for this content.' };
  }
  if (r.pic_id != null && (!old || r.pic_id !== old.pic_id)) {
    const ok = store.people.some((p) => p.id === r.pic_id && p.role_id === r.role_id && p.is_active);
    if (!ok) return { error: 'The PIC must be an active member of this tracker.' };
  }

  if (!store.roleBrands.some((rb) => rb.role_id === r.role_id && rb.brand_id === r.brand_id)) {
    return { error: `Brand "${r.brand_id}" is not part of this tracker.` };
  }
  for (const f of TEXT) r[f] = r[f] == null ? null : String(r[f]).trim() || null;
  const missing = REQUIRED.filter((f) => r[f] == null || r[f] === '');
  const options = store.pillars.filter((p) => p.brand_id === r.brand_id).map((p) => p.name);
  if (options.length) {
    const unknown = (r.content_pillars ?? []).filter((p) => !options.includes(p));
    if (unknown.length) return { error: `Unknown content pillar(s): ${unknown.join(', ')}` };
    r.content_pillars = options.filter((p) => (r.content_pillars ?? []).includes(p));
    if (!r.content_pillars.length) missing.push('content_pillars');
  } else {
    r.content_pillars = [];
  }
  r.missing_fields = missing;
  if (r.instagram_url) {
    if (missing.length) {
      if (old?.instagram_url) {
        return { error: `This item is already uploaded, so every field must stay filled. Missing: ${missing.join(', ')}` };
      }
      return { error: `Fill in every field before adding the Instagram link. Missing: ${missing.join(', ')}` };
    }
    if (!/^https?:\/\/([a-z0-9-]+\.)?instagram\.com\/.+/i.test(r.instagram_url)) {
      return { error: 'Uploaded content must be an Instagram post link, e.g. https://www.instagram.com/p/...' };
    }
    r.status = 'uploaded';
    if (!old || old.instagram_url !== r.instagram_url) r.uploaded_at = nowIso();
  } else if (!missing.length) {
    r.status = 'planned';
    r.uploaded_at = null;
  } else {
    r.status = 'not_started';
    r.uploaded_at = null;
  }
  r.updated_at = nowIso();
  if (actor) {
    r.updated_by = actor.id;
    r.updated_by_name = actor.display_name;
  }
  return { row: r };
}

function makeItem(store, { role, brand, owner, pic, status, date, type, title, pillars, editedBy, daysAgo = 1 }) {
  const person = store.people.find((p) => p.id === owner);
  const filled = status !== 'not_started';
  const input = {
    id: uid(),
    role_id: role,
    brand_id: brand,
    owner_id: owner,
    pic_id: pic === undefined ? (owner === 'u-admin' ? null : owner) : pic,
    content: title,
    type: type ?? (seq % 3 === 0 ? 'reels' : 'feed'),
    brief: BRIEF,
    caption: filled || seq % 2 ? CAPTION : null,
    notes: filled ? NOTES : null,
    publish_date: date,
    reference: filled ? REFERENCE : null,
    content_pillars: pillars ?? [],
    instagram_url: status === 'uploaded' ? `https://www.instagram.com/p/C${uid().slice(0, 9)}/` : null,
  };
  seq += 1;
  const { row, error } = computeItem(store, input, null, null);
  if (error) throw new Error(`mock fixture: ${error}`);
  const created = date ? addDays(date, -6) : todayWIB();
  row.created_at = wib(created < todayWIB() ? created : todayWIB(), 9, 15);
  const editor = store.people.find((p) => p.id === (editedBy ?? owner));
  const editedTs = new Date(Date.now() - daysAgo * 3600 * 1000 * (status === 'uploaded' ? 20 : 3)).toISOString();
  row.updated_at = editedTs > row.created_at ? editedTs : row.created_at;
  row.updated_by = editor.id;
  row.updated_by_name = editor.display_name;
  if (status === 'uploaded') row.uploaded_at = row.updated_at;
  store.items.push(row);
  store.activity.push({
    id: store.activity.length + 1,
    role_id: role,
    item_id: row.id,
    actor_id: owner,
    actor_name: person.display_name,
    action: 'item_created',
    summary: title,
    changes: { brand_id: brand, pic_id: row.pic_id },
    created_at: row.created_at,
  });
  if (status === 'uploaded') {
    store.activity.push({
      id: store.activity.length + 1,
      role_id: role,
      item_id: row.id,
      actor_id: editor.id,
      actor_name: editor.display_name,
      action: 'item_updated',
      summary: title,
      changes: { instagram_url: { old: null, new: row.instagram_url }, status: { old: 'planned', new: 'uploaded' } },
      created_at: row.updated_at,
    });
  }
  return row;
}

/**
 * A month of items for one PIC × brand: uploaded Reels/Feed, planned, not started, undated.
 * Uploads spread over the month so far; planned and not started items come later.
 */
function batch(store, { role, brand, pic, owner = pic, month, today, reels = 0, feed = 0, planned = 0, notStarted = 0, noDate = 0, pillars, offset = 0 }) {
  const dim = daysInMonth(month);
  const day = (n) => `${month}-${String(Math.min(Math.max(n, 1), dim)).padStart(2, '0')}`;
  const isCurrent = month === today.slice(0, 7);
  const d = isCurrent ? Number(today.slice(8)) : dim;
  let t = offset;
  const next = () => {
    t += 1;
    return TITLES[t % TITLES.length];
  };
  const pillarAt = (i) => (pillars ? [pillars[i % pillars.length], ...(i % 3 === 0 ? [pillars[(i + 2) % pillars.length]] : [])] : undefined);
  const uploads = [...Array(reels).fill('reels'), ...Array(feed).fill('feed')];
  uploads.forEach((type, i) => {
    const span = Math.max(d, 12);
    makeItem(store, { role, brand, owner, pic, status: 'uploaded', type, date: day(1 + Math.floor((i * span) / Math.max(uploads.length, 1))), title: next(), pillars: pillarAt(i), daysAgo: uploads.length - i });
  });
  for (let i = 0; i < planned; i += 1) {
    makeItem(store, { role, brand, owner, pic, status: 'planned', type: i % 2 ? 'feed' : 'reels', date: day(d + 2 + i * 3), title: next(), pillars: pillarAt(i + 1), daysAgo: 2 });
  }
  for (let i = 0; i < notStarted; i += 1) {
    makeItem(store, { role, brand, owner, pic, status: 'not_started', date: day(d + 4 + i * 5), title: next(), daysAgo: 1 });
  }
  for (let i = 0; i < noDate; i += 1) {
    makeItem(store, { role, brand, owner, pic, status: 'not_started', date: null, title: next(), daysAgo: 0.2 });
  }
}

function target(store, { profile, brand, month, reels, feed, note = null }) {
  const person = store.people.find((p) => p.id === profile);
  store.targets.push({
    id: uid(),
    month: monthStart(month),
    role_id: person.role_id,
    brand_id: brand,
    profile_id: profile,
    target_reels: reels,
    target_feed: feed,
    target_total: reels + feed,
    note,
    set_by: 'u-admin',
    updated_at: nowIso(),
  });
}

/** A 1500×600 abstract banner (the dot motif), as a data URL: no network, no files. */
function demoBanner() {
  const dots = [];
  const colors = ['#9ECD59', '#FF8A3D', '#8F7CF7', '#4D8DFF'];
  for (let y = 0; y < 13; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const lit = (x * 7 + y * 13) % 23 === 0;
      const r = lit ? 7 : 2.4;
      const fill = lit ? colors[(x + y) % colors.length] : '#3a3a40';
      dots.push(`<circle cx="${30 + x * 47}" cy="${24 + y * 46}" r="${r}" fill="${fill}"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="600" viewBox="0 0 1500 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d2a14"/><stop offset=".55" stop-color="#17161d"/><stop offset="1" stop-color="#2a1d3f"/></linearGradient><radialGradient id="h" cx=".78" cy=".2" r=".6"><stop offset="0" stop-color="#9ECD59" stop-opacity=".35"/><stop offset="1" stop-color="#9ECD59" stop-opacity="0"/></radialGradient></defs><rect width="1500" height="600" fill="url(#g)"/><rect width="1500" height="600" fill="url(#h)"/>${dots.join('')}<path d="M0 470 C 300 400, 600 560, 900 470 S 1300 380, 1500 450 L1500 600 L0 600 Z" fill="#131218" opacity=".55"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function createStore() {
  const store = {
    roles: ROLES,
    brands: BRANDS,
    roleBrands: ROLE_BRANDS,
    pillars: PILLARS,
    people: PEOPLE.map((p) => ({ ...p })),
    items: [],
    targets: [],
    comments: [],
    activity: [],
    banners: [],
    files: new Map(), // storage path → URL
  };
  const today = todayWIB();
  const m = currentMonthWIB();
  const p = shiftMonth(m, -1);
  const homyPillars = PILLARS.map((x) => x.name);

  // ---------------------------------------------------------------- targets (this month and last)
  for (const month of [m, p]) {
    const past = month === p;
    target(store, { profile: 'u-excel', brand: 'lahap', month, reels: 5, feed: 8 });
    target(store, { profile: 'u-excel', brand: 'kedai_makmoer_88', month, reels: 4, feed: 8 });
    target(store, { profile: 'u-dika', brand: 'beefix', month, reels: 8, feed: 12, note: past ? null : 'Fokus Reels produk baru minggu ini' });
    target(store, { profile: 'u-zaki', brand: 'homy8', month, reels: 6, feed: 9 });
    target(store, { profile: 'u-arum', brand: 'behomy', month, reels: 7, feed: 12, note: past ? null : 'Shooting batch 2 tanggal 14' });
    target(store, { profile: 'u-arum', brand: 'behomy_group', month, reels: 0, feed: 5 });
    target(store, { profile: 'u-arum', brand: 'corvel', month, reels: 3, feed: 3 });
    target(store, { profile: 'u-ilyas', brand: 'behomy', month, reels: 17, feed: 0 });
    target(store, { profile: 'u-ilyas', brand: 'hoteru', month, reels: 2, feed: 4 });
    target(store, { profile: 'u-anne', brand: 'purnava', month, reels: 4, feed: 6 });
    target(store, { profile: 'u-anne', brand: 'hoteru', month, reels: 3, feed: 3 });
    if (!past) target(store, { profile: 'u-anne', brand: 'corvel', month, reels: 2, feed: 3 });
  }

  // ---------------------------------------------------------------- this month's items
  batch(store, { role: 'beefix', brand: 'beefix', pic: 'u-dika', month: m, today, reels: 4, feed: 5, planned: 4, notStarted: 3, noDate: 2 });
  batch(store, { role: 'homy8', brand: 'homy8', pic: 'u-zaki', month: m, today, reels: 2, feed: 4, planned: 3, notStarted: 2, noDate: 1, pillars: homyPillars, offset: 3 });
  batch(store, { role: 'lahap_makmoer', brand: 'lahap', pic: 'u-excel', month: m, today, reels: 3, feed: 4, planned: 3, notStarted: 2, noDate: 1, offset: 1 });
  batch(store, { role: 'lahap_makmoer', brand: 'kedai_makmoer_88', pic: 'u-excel', month: m, today, reels: 1, feed: 4, planned: 2, notStarted: 3, noDate: 1, offset: 7 });
  batch(store, { role: 'behomy', brand: 'behomy', pic: 'u-arum', month: m, today, reels: 3, feed: 4, planned: 1, notStarted: 1, noDate: 1, offset: 2 });
  batch(store, { role: 'behomy', brand: 'corvel', pic: 'u-arum', month: m, today, reels: 1, feed: 0, planned: 1, offset: 4 });
  batch(store, { role: 'behomy', brand: 'purnava', pic: 'u-arum', month: m, today, reels: 1, feed: 1, offset: 5 }); // uploads, no target
  batch(store, { role: 'behomy', brand: 'behomy', pic: 'u-ilyas', month: m, today, reels: 5, feed: 2, planned: 2, notStarted: 1, noDate: 1, offset: 6 }); // Feed over a 0 target
  batch(store, { role: 'behomy', brand: 'hoteru', pic: 'u-ilyas', month: m, today, reels: 1, feed: 1, offset: 8 });
  batch(store, { role: 'behomy', brand: 'hoteru', pic: 'u-anne', month: m, today, reels: 5, feed: 1, planned: 0, notStarted: 1, offset: 11 }); // 6/6 with extra Reels
  batch(store, { role: 'behomy', brand: 'purnava', pic: 'u-anne', month: m, today, reels: 1, feed: 2, offset: 12 });
  // Admin made items in Behomy: one with Arum as PIC, one from before v2 that still needs a PIC
  batch(store, { role: 'behomy', brand: 'behomy', owner: 'u-admin', pic: 'u-arum', month: m, today, feed: 1, offset: 13 });
  batch(store, { role: 'behomy', brand: 'behomy_group', owner: 'u-admin', pic: null, month: m, today, feed: 1, planned: 1, offset: 14 });

  // ---------------------------------------------------------------- last month's items
  batch(store, { role: 'beefix', brand: 'beefix', pic: 'u-dika', month: p, today, reels: 7, feed: 10, planned: 1, offset: 5 });
  batch(store, { role: 'homy8', brand: 'homy8', pic: 'u-zaki', month: p, today, reels: 6, feed: 9, pillars: homyPillars, offset: 8 });
  batch(store, { role: 'lahap_makmoer', brand: 'lahap', pic: 'u-excel', month: p, today, reels: 5, feed: 6, planned: 1, offset: 2 });
  batch(store, { role: 'lahap_makmoer', brand: 'kedai_makmoer_88', pic: 'u-excel', month: p, today, reels: 4, feed: 8, offset: 4 });
  batch(store, { role: 'behomy', brand: 'behomy', pic: 'u-arum', month: p, today, reels: 9, feed: 10, offset: 3 });
  batch(store, { role: 'behomy', brand: 'behomy_group', pic: 'u-arum', month: p, today, feed: 4, offset: 9 });
  batch(store, { role: 'behomy', brand: 'corvel', pic: 'u-arum', month: p, today, reels: 3, feed: 3, offset: 10 });
  batch(store, { role: 'behomy', brand: 'behomy', pic: 'u-ilyas', month: p, today, reels: 17, offset: 9 });
  batch(store, { role: 'behomy', brand: 'hoteru', pic: 'u-ilyas', month: p, today, reels: 2, feed: 3, offset: 1 });
  batch(store, { role: 'behomy', brand: 'purnava', pic: 'u-anne', month: p, today, reels: 4, feed: 5, planned: 1, offset: 12 });
  batch(store, { role: 'behomy', brand: 'hoteru', pic: 'u-anne', month: p, today, reels: 3, feed: 3, offset: 7 });

  // a busy day on the Behomy calendar ("+N more")
  const busy = `${m}-${String(Math.min(Number(today.slice(8)) + 5, daysInMonth(m))).padStart(2, '0')}`;
  ['u-arum', 'u-ilyas', 'u-anne', 'u-arum', 'u-ilyas'].forEach((pic, i) =>
    makeItem(store, { role: 'behomy', brand: ['behomy', 'behomy_group', 'corvel', 'hoteru', 'purnava'][i], owner: pic, pic, status: i % 2 ? 'planned' : 'not_started', type: i % 2 ? 'reels' : 'feed', date: busy, title: TITLES[(i + 4) % TITLES.length] }),
  );

  // a few comments + an Admin edit, so threads and history have something in them
  const arumItem = store.items.find((i) => i.pic_id === 'u-arum' && i.status === 'planned');
  const dikaItem = store.items.find((i) => i.pic_id === 'u-dika' && i.status === 'not_started' && i.publish_date);
  const comment = (item, who, body, hoursAgo) => {
    const person = store.people.find((x) => x.id === who);
    const row = { id: uid(), item_id: item.id, role_id: item.role_id, author_id: who, author_name: person.display_name, body, created_at: new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString() };
    store.comments.push(row);
    store.activity.push({ id: store.activity.length + 1, role_id: item.role_id, item_id: item.id, actor_id: who, actor_name: person.display_name, action: 'comment_added', summary: item.content, changes: { comment_id: row.id, body }, created_at: row.created_at });
  };
  if (arumItem) {
    comment(arumItem, 'u-ilyas', 'Fotonya pakai yang di showroom aja, lighting-nya lebih bagus.', 26);
    comment(arumItem, 'u-admin', 'Setuju. Caption sudah oke, tinggal cek hashtag ya.', 3);
    comment(arumItem, 'u-arum', 'Siap, aku update sore ini.', 0.4);
    store.activity.push({ id: store.activity.length + 1, role_id: 'behomy', item_id: arumItem.id, actor_id: 'u-admin', actor_name: 'Admin Beyondcy', action: 'item_updated', summary: arumItem.content, changes: { caption: { old: 'Promo lama, berlaku minggu ini saja.', new: arumItem.caption }, pic_id: { old: 'u-ilyas', new: 'u-arum' } }, created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString() });
  }
  if (dikaItem) comment(dikaItem, 'u-admin', 'Referensinya tolong ditambah ya, minimal 2 link.', 5);

  // Behomy has a banner; the other trackers start without one
  const bannerPath = 'behomy/demo-banner.svg';
  store.files.set(bannerPath, demoBanner());
  store.banners.push({ role_id: 'behomy', image_path: bannerPath, position_y: 50, updated_by: 'u-arum', updated_by_name: 'Arum', updated_at: nowIso() });

  return store;
}
