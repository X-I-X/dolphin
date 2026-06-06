#!/usr/bin/env python3
"""
Batch P2 — futureComm series fixes
- Fix archive-notice self-referential hrefs
- Remove old nav GIF buttons (menunew, menuhome, menuoutline, dolphinback)
- Fix broken ../../Desktop%20Folder/ link in futureComm00
- Remove old-site-nav-link text nav artifacts
- Remove dead eccosys.com hit counter images
"""

import re
import os

B = '/home/node/.openclaw/workspace/builds/jcl-hub'

pages = [
    'futureComm00.html',
    'futureComm20.html',
    'futureComm21.html',
    'futureComm22.html',
    'futureComm23.html',
    'futureComm24.html',
    'futureComm24A.html',
    'futureComm25.html',
    'futureComm26.html',
    'futureComm27.html',
    'futureComm28.html',
    'futureComm29.html',
    'futureComm30.html',
    'futureComm31.html',
    'futureComm40.html',
    'futureComm41.html',
]

def fix_page(fn):
    fp = os.path.join(B, fn)
    html = open(fp, encoding='utf-8').read()
    fixes = []

    # --- 1. Fix archive-notice self-referential href ---
    # Pattern: href="futureCommXX.html" inside archive-notice
    # Should be: href="http://www.johnclilly.com/futureCommXX.html"
    # We match href="futureComm..." (without http) inside archive-notice block
    def fix_archive_notice_href(m):
        orig_href = m.group(1)
        if orig_href.startswith('http'):
            return m.group(0)  # already correct
        # Build the johnclilly.com URL
        jcl_url = 'http://www.johnclilly.com/' + orig_href
        fixed = m.group(0).replace(f'href="{orig_href}"', f'href="{jcl_url}"', 1)
        return fixed

    # Find archive-notice block and fix href within it
    notice_pattern = re.compile(
        r'(<div class="archive-notice">.*?</div>)',
        re.DOTALL
    )
    notice_match = notice_pattern.search(html)
    if notice_match:
        notice_block = notice_match.group(1)
        # Find href="futureCommXX.html" (not http)
        href_pat = re.compile(r'href="(futureComm[^"]+\.html)"')
        if href_pat.search(notice_block):
            fixed_notice = href_pat.sub(
                lambda m: f'href="http://www.johnclilly.com/{m.group(1)}"',
                notice_block
            )
            html = html.replace(notice_block, fixed_notice, 1)
            fixes.append('fixed archive-notice href → johnclilly.com')

    # --- 2. Remove eccosys.com hit counter ---
    eccosys_pat = re.compile(
        r'<img\s+src="http://www2\.eccosys\.com/cgi-bin/Count\.cgi[^"]*"[^>]*>',
        re.IGNORECASE
    )
    if eccosys_pat.search(html):
        html = eccosys_pat.sub('', html)
        fixes.append('removed eccosys.com hit counter')

    # --- 3. Fix broken Desktop Folder link in futureComm00 ---
    if '../../Desktop%20Folder/futureComm22.html' in html:
        html = html.replace('../../Desktop%20Folder/futureComm22.html', 'futureComm22.html')
        fixes.append('fixed broken Desktop Folder link → futureComm22.html')

    # --- 4. Remove old nav GIF button blocks ---
    # Pattern: <div class="photo-grid-item"><a href="..."><div class="photo-grid-item"><img src="...menunew.gif...">...</a>
    # Or: <a href="..."><div class="photo-grid-item"><img src="...menunew.gif..."></div></a>
    # These appear in futureComm00 and futureComm40

    # Remove the "Splash" old-site-nav-link div
    # <div class="photo-grid-item"><a href="index.html" class="old-site-nav-link">Splash</a></div>
    splash_div_pat = re.compile(
        r'<div class="photo-grid-item"><a\s+href="[^"]*"\s+class="old-site-nav-link">Splash</a></div>',
        re.DOTALL
    )
    if splash_div_pat.search(html):
        html = splash_div_pat.sub('', html)
        fixes.append('removed Splash old-site-nav-link div')

    # Remove nav GIF button links: <a href="..."><div class="photo-grid-item"><img src="...menunew.gif..."></div></a>
    nav_gif_pat = re.compile(
        r'<a\s+href="[^"]*">\s*<div class="photo-grid-item">\s*<img\s+src="[^"]*(?:menunew|menuhome|menuoutline)\.gif[^"]*"[^>]*>\s*</div>\s*</a>',
        re.DOTALL | re.IGNORECASE
    )
    count_gifs = len(nav_gif_pat.findall(html))
    if count_gifs > 0:
        html = nav_gif_pat.sub('', html)
        fixes.append(f'removed {count_gifs} nav GIF button(s) (menunew/menuhome/menuoutline)')

    # Remove dolphinback GIF nav link: <a href="vortex.html"><div class="photo-grid-item"><figure ...><img src="...dolphinback.gif"...></figure></div></a>
    dolphinback_pat = re.compile(
        r'<a\s+href="[^"]*">\s*<div class="photo-grid-item">\s*<figure[^>]*>\s*<img\s+src="[^"]*dolphinback\.gif[^"]*"[^>]*>\s*</figure>\s*</div>\s*</a>',
        re.DOTALL | re.IGNORECASE
    )
    if dolphinback_pat.search(html):
        html = dolphinback_pat.sub('', html)
        fixes.append('removed dolphinback.gif nav link')

    # --- 5. Remove old-site-nav-link text nav blocks ---
    # Pattern 1: <p><a href="..." class="old-site-nav-link">...</a>...</p>
    # Pattern 2: standalone <a href="..." class="old-site-nav-link">Back</a>
    # In futureComm41: <p><a href="index.html" class="old-site-nav-link">Splash</a><a href="whatsnew.html"...>...
    old_nav_p_pat = re.compile(
        r'<p>\s*(?:<a\s+href="[^"]*"\s+class="old-site-nav-link">[^<]*</a>)+\s*</p>',
        re.DOTALL
    )
    count_nav_p = len(old_nav_p_pat.findall(html))
    if count_nav_p > 0:
        html = old_nav_p_pat.sub('', html)
        fixes.append(f'removed {count_nav_p} old-site-nav-link <p> block(s)')

    # Standalone back link: <a href="futureComm40.html" class="old-site-nav-link">Back</a>
    back_link_pat = re.compile(
        r'<a\s+href="[^"]*"\s+class="old-site-nav-link">Back</a>',
        re.DOTALL
    )
    if back_link_pat.search(html):
        html = back_link_pat.sub('', html)
        fixes.append('removed standalone old-site-nav-link Back link')

    # Any remaining old-site-nav-link anchors that weren't caught
    remaining_pat = re.compile(r'<a\s+[^>]*class="old-site-nav-link"[^>]*>[^<]*</a>')
    remaining = remaining_pat.findall(html)
    if remaining:
        html = remaining_pat.sub('', html)
        fixes.append(f'removed {len(remaining)} remaining old-site-nav-link anchor(s): {remaining[:3]}')

    # Write if changed
    if fixes:
        open(fp, 'w', encoding='utf-8').write(html)

    return fixes


def mobile_pass(fn):
    fp = os.path.join(B, fn)
    html = open(fp, encoding='utf-8').read()
    fixes = []
    issues = []

    # 1. Viewport meta
    if 'width=device-width' not in html:
        html = html.replace('<head>', '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">', 1)
        fixes.append('added viewport meta')

    # 2. Images without loading=lazy (only on <img> that don't already have it)
    # Count imgs without loading
    imgs_no_lazy = re.findall(r'<img (?!.*?loading=)[^>]+>', html)
    if imgs_no_lazy:
        # Add loading="lazy" to img tags that don't have it
        def add_lazy(m):
            tag = m.group(0)
            if 'loading=' not in tag:
                return tag.replace('<img ', '<img loading="lazy" ')
            return tag
        html = re.sub(r'<img [^>]+>', add_lazy, html)
        fixes.append(f'added lazy loading to {len(imgs_no_lazy)} image(s)')

    # 3. Fixed-width inline styles
    fw = re.findall(r'width:\s*([89][0-9]{2,}|1[0-9]{3,})px', html)
    if fw:
        issues.append(f'fixed-width values: {fw[:3]}')

    # 4. slider.js linked
    if 'img-slider' in html and 'slider.js' not in html:
        html = html.replace('</body>', '<script src="slider.js"></script>\n</body>', 1)
        fixes.append('added slider.js link')

    # 5. Nav drawer IDs present
    if 'hamburger' not in html:
        issues.append('missing hamburger nav')

    # 6. View Original button present
    if 'view-original-btn' not in html:
        issues.append('missing view-original-btn')

    if fixes or issues:
        open(fp, 'w', encoding='utf-8').write(html)

    return {'fixed': fixes, 'issues': issues}


# --- Run all fixes ---
print("=" * 60)
print("BATCH P2 — futureComm series — Content Fixes")
print("=" * 60)

results = {}
for page in pages:
    fixes = fix_page(page)
    results[page] = {'content_fixes': fixes}
    if fixes:
        print(f"\n✅ {page}:")
        for f in fixes:
            print(f"   • {f}")
    else:
        print(f"\n⬜ {page}: no content fixes needed")

print("\n" + "=" * 60)
print("PHASE 2 — Mobile Optimization Pass")
print("=" * 60)

for page in pages:
    mob = mobile_pass(page)
    results[page]['mobile'] = mob
    status = []
    if mob['fixed']:
        status.append(f"fixed: {', '.join(mob['fixed'])}")
    if mob['issues']:
        status.append(f"issues: {', '.join(mob['issues'])}")
    if not status:
        status = ['pass']
    print(f"\n{'✅' if not mob['issues'] else '⚠️'} {page}: {'; '.join(status)}")

print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
for page, r in results.items():
    mob_status = '✅ pass' if not r['mobile']['issues'] else f"⚠️ {'; '.join(r['mobile']['issues'])}"
    print(f"{page}: {len(r['content_fixes'])} fix(es) | Mobile: {mob_status}")
