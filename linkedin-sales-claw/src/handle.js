// One definition of "the same person": the LinkedIn public slug, from
// /in/<slug>/. Display names collide; slugs do not.
export function slugOf(urlOrSlug) {
  const s = String(urlOrSlug ?? '').trim();
  const m = /\/in\/([^/?#]+)/i.exec(s);
  return decodeURIComponent(m ? m[1] : s).replace(/\/$/, '').toLowerCase();
}
