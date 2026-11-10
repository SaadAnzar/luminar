/**
 * Strip script vectors from a generated scene SVG. Our SVGs are CSS-only, but
 * they're inlined with dangerouslySetInnerHTML / rendered into frames, so never
 * trust the markup.
 */
export function sanitizeSvg(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
}

/**
 * Inline the scene SVG into the DOM.
 *
 * We deliberately do NOT use <object>/<img src>: Supabase Storage serves objects
 * with `Content-Disposition: attachment` and a locked-down `CSP: default-src
 * 'none'; sandbox`, so an embedded/fetched-as-document SVG renders blank and its
 * CSS @keyframes are blocked. Fetching the markup (CORS is open) and inlining it
 * puts the SVG in the host document, where it renders, scales via viewBox, and
 * animates under the app's CSP. This also fixes every already-generated luminar
 * without re-rendering anything.
 */
export function makeInlineSvg(raw: string): string {
  let s = sanitizeSvg(raw)
  // drop the fixed width/height on the root <svg> so the viewBox drives scaling
  s = s
    .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/i, "$1")
    .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/i, "$1")
  // ensure it fills its box
  s = s.replace(
    /<svg\b/i,
    '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block"',
  )
  return s
}
