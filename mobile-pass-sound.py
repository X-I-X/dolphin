#!/usr/bin/env python3
"""Mobile optimization pass — sound series (Batch P3)"""
import re, os

B = '/home/node/.openclaw/workspace/builds/jcl-hub'

sound_pages = [
    'sound01.html','sound01x.html','sound02.html','sound02x.html',
    'sound03.html','sound03x.html','sound04.html','sound04x.html',
    'sound05.html','sound05x.html',
    'sound06x.html','sound07x.html','sound08x.html','sound09x.html',
    'sound10x.html','sound11x.html',
]

def mobile_pass(fn):
    fp = f'{B}/{fn}'
    if not os.path.exists(fp):
        return {'fixed': [], 'issues': [f'FILE MISSING: {fn}']}
    html = open(fp, encoding='utf-8').read()
    issues = []
    fixed = []

    # 1. Viewport meta
    if 'width=device-width' not in html:
        html = html.replace('<head>', '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">', 1)
        fixed.append('added viewport meta')

    # 2. Images without loading=lazy — only add if no loading attr at all
    img_tags = re.findall(r'<img [^>]+>', html)
    for tag in img_tags:
        if 'loading=' not in tag:
            new_tag = tag.replace('<img ', '<img loading="lazy" ')
            html = html.replace(tag, new_tag, 1)
            fixed.append(f'added lazy loading to img: {tag[:60]}...')

    # 3. Fixed-width inline styles (>768px)
    fw = re.findall(r'width:\s*([89][0-9]{2,}|1[0-9]{3,})px', html)
    if fw:
        issues.append(f'fixed-width values found: {fw[:3]}')

    # 4. slider.js linked
    if 'img-slider' in html and 'slider.js' not in html:
        html = html.replace('</body>', '<script src="slider.js"></script>\n</body>', 1)
        fixed.append('added slider.js link')

    # 5. Nav drawer IDs present
    if 'hamburger' not in html:
        issues.append('missing hamburger nav')

    # 6. View Original button present
    if 'view-original-btn' not in html:
        issues.append('missing view-original-btn')

    # 7. white-space: nowrap check (non-nav)
    nowrap = re.findall(r'white-space:\s*nowrap', html)
    if nowrap:
        issues.append(f'white-space:nowrap found ({len(nowrap)} instances) — may cause horizontal scroll')

    if fixed or issues:
        open(fp, 'w', encoding='utf-8').write(html)

    return {'fixed': fixed, 'issues': issues}

all_results = {}
for page in sound_pages:
    r = mobile_pass(page)
    all_results[page] = r
    status = '✅' if not r['issues'] else '⚠️'
    print(f"{status} {page}")
    for f in r['fixed']:
        print(f"   fix: {f}")
    for i in r['issues']:
        print(f"   issue: {i}")

print(f"\nTotal pages: {len(sound_pages)}")
fixed_count = sum(1 for r in all_results.values() if r['fixed'])
issue_count = sum(1 for r in all_results.values() if r['issues'])
print(f"Pages with fixes applied: {fixed_count}")
print(f"Pages with remaining issues: {issue_count}")
