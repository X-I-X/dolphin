#!/usr/bin/env python3
"""Mobile optimization pass for Batch P14 pages"""
import re, os

B = '/home/node/.openclaw/workspace/builds/jcl-hub'

P14_PAGES = [
    'BT_JCL_ICERC1999.html',
    'InstOfEcotConf1998.html',
    'JCL_AFDB_Basel.html',
    'JCL_DH_Basel.html',
    'JCL_JA_InstOfEcot.html',
    'JCL_JH_Switz.html',
    'JCL_K_ICERC1999.html',
    'JCL_LT_LC1998.html',
    'JCL_OJaniger.html',
    'K_JN_K_ICERC1999.html',
    'PB_OJ_KJ_JCL.html',
    'PHB_JCL_PS_NYC1998.html',
    'AHofmann_TLeary.html',
    'albertJohn01.html',
    'accounts.html',
    'eccoCD.html',
    'janus00x.html',
    'accountsx.html',
    'musicvid.html',
]

def mobile_pass(fn):
    fp = f'{B}/{fn}'
    html = open(fp, encoding='utf-8').read()
    issues = []
    fixed = []

    # 1. Viewport meta
    if 'width=device-width' not in html:
        html = html.replace('<head>', '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">', 1)
        fixed.append('added viewport meta')

    # 2. Images without loading=lazy
    img_count = html.count('<img ')
    lazy_count = html.count('loading=')
    if img_count > 0 and lazy_count == 0:
        html = html.replace('<img ', '<img loading="lazy" ')
        fixed.append('added lazy loading to images')

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

    if fixed or issues:
        open(fp, 'w', encoding='utf-8').write(html)

    return {'fixed': fixed, 'issues': issues}

print("=== MOBILE PASS — BATCH P14 ===\n")
all_clean = True
for fn in P14_PAGES:
    r = mobile_pass(fn)
    if r['fixed'] or r['issues']:
        all_clean = False
        status = '⚠️ ' if r['issues'] else '✅'
        print(f"  {status} {fn}")
        for f in r['fixed']:
            print(f"     fixed: {f}")
        for i in r['issues']:
            print(f"     issue: {i}")
    else:
        print(f"  ✅ {fn} — pass (no changes needed)")

if all_clean:
    print("\nAll 19 pages passed mobile check clean.")
