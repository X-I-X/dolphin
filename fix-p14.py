#!/usr/bin/env python3
"""Batch P14 fix script — conference pages + non-x stubs cleanup"""
import re, os

B = '/home/node/.openclaw/workspace/builds/jcl-hub'

def read(fn):
    return open(f'{B}/{fn}', encoding='utf-8').read()

def write(fn, content):
    open(f'{B}/{fn}', 'w', encoding='utf-8').write(content)

results = {}

# ─────────────────────────────────────────────────────────────────────────────
# GROUP 1: Conference/event photo pages
# Fix: (1) archive-notice self-ref href → johnclilly.com URL
#      (2) old-site-nav-link Previous/Next artifact lines → remove
# ─────────────────────────────────────────────────────────────────────────────
CONF_PAGES = [
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
]

for fn in CONF_PAGES:
    fp = f'{B}/{fn}'
    if not os.path.exists(fp):
        results[fn] = {'status': 'MISSING'}
        continue
    html = read(fn)
    fixed = []

    # Fix 1: archive-notice self-ref href
    # Pattern: href="FILENAME.html" rel="noopener" data-original-href="http://www.johnclilly.com/FILENAME.html"
    # Replace: href with the johnclilly.com URL + add target="_blank"
    pattern1 = rf'href="{re.escape(fn)}" rel="noopener" (data-original-href="http://www\.johnclilly\.com/{re.escape(fn)}")'
    replacement1 = rf'href="http://www.johnclilly.com/{fn}" target="_blank" rel="noopener" \1'
    new_html = re.sub(pattern1, replacement1, html)
    if new_html != html:
        fixed.append('archive-notice self-ref href fixed')
        html = new_html

    # Fix 2: Remove old-site-nav-link Previous/Next lines
    # These appear as lines containing old-site-nav-link near end of prose block
    # Pattern varies but always contains class="old-site-nav-link"
    # Remove entire lines (including surrounding whitespace) that are nav artifacts
    # The "back" link to photosx.html between them should also go — it's a nav artifact
    
    # Strategy: find the block ending with old-site-nav-link anchors and remove it
    # Typical structure:
    #   <a href="PREV.html" class="old-site-nav-link">Previous</a> \n
    #   <a href="photosx.html">back</a> <a href="NEXT.html" class="old-site-nav-link">Next</a> \n
    # Or: single line with both prev and next, plus back link
    
    # Remove lines that consist only/primarily of old-site-nav-link anchors (Previous/Next)
    # and the associated "back" link between them
    old_count_before = html.count('old-site-nav-link')
    
    # Pattern: remove the nav cluster — Previous/back/Next block
    # Handle multiline: remove from start of Previous anchor to end of Next anchor line
    html = re.sub(
        r'\s*<a href="[^"]*" class="old-site-nav-link">Previous</a>\s*\n\s*<a href="[^"]*">back</a>\s*<a href="[^"]*" class="old-site-nav-link">Next</a>\s*\n',
        '\n',
        html
    )
    # Also handle single-line variant
    html = re.sub(
        r'\s*<a href="[^"]*" class="old-site-nav-link">Previous</a>\s*<a href="[^"]*">back</a>\s*<a href="[^"]*" class="old-site-nav-link">Next</a>\s*\n',
        '\n',
        html
    )
    # Handle albertJohn01.html which has Previous on its own line without back link
    html = re.sub(
        r'\s*<a href="[^"]*" class="old-site-nav-link">Previous</a>\s*\n\s*<a href="[^"]*">back</a>\s*<a href="[^"]*" class="old-site-nav-link">Next</a>',
        '',
        html
    )
    
    old_count_after = html.count('old-site-nav-link')
    if old_count_after < old_count_before:
        fixed.append(f'removed {old_count_before - old_count_after} old-site-nav-link artifacts')

    write(fn, html)
    results[fn] = {'fixed': fixed, 'remaining_old_nav': html.count('old-site-nav-link')}

# ─────────────────────────────────────────────────────────────────────────────
# GROUP 2: accounts.html — GIF nav cluster + self-ref href
# ─────────────────────────────────────────────────────────────────────────────
fn = 'accounts.html'
html = read(fn)
fixed = []

# Fix 1: archive-notice self-ref href
p = rf'href="{re.escape(fn)}" rel="noopener" (data-original-href="http://www\.johnclilly\.com/{re.escape(fn)}")'
r = rf'href="http://www.johnclilly.com/{fn}" target="_blank" rel="noopener" \1'
new = re.sub(p, r, html)
if new != html:
    fixed.append('archive-notice self-ref href fixed')
    html = new

# Fix 2: Remove GIF nav cluster
# Starts with: <div class="photo-grid-item"><a href="index.html" class="old-site-nav-link">Splash</a></div>
# Ends with: </figure></div></a>  (the dolphinback figure)
# The whole cluster is on two lines (102-103)
old_nav_count = html.count('old-site-nav-link')
gif_cluster_pattern = r'<div class="photo-grid-item"><a href="index\.html" class="old-site-nav-link">Splash</a></div>.*?</figure></div></a>'
html = re.sub(gif_cluster_pattern, '', html, flags=re.DOTALL)
new_old_nav_count = html.count('old-site-nav-link')
if new_old_nav_count < old_nav_count:
    fixed.append(f'removed GIF nav cluster (dolphinback + menu GIFs)')

write(fn, html)
results[fn] = {'fixed': fixed, 'remaining_old_nav': html.count('old-site-nav-link')}

# ─────────────────────────────────────────────────────────────────────────────
# GROUP 3: eccoCD.html — GIF nav cluster + self-ref href
# ─────────────────────────────────────────────────────────────────────────────
fn = 'eccoCD.html'
html = read(fn)
fixed = []

# Fix 1: archive-notice self-ref href
p = rf'href="{re.escape(fn)}" rel="noopener" (data-original-href="http://www\.johnclilly\.com/{re.escape(fn)}")'
r = rf'href="http://www.johnclilly.com/{fn}" target="_blank" rel="noopener" \1'
new = re.sub(p, r, html)
if new != html:
    fixed.append('archive-notice self-ref href fixed')
    html = new

# Fix 2: Remove GIF nav cluster (different starting structure - starts after </p>)
# Pattern: </p><div class="photo-grid-item"><a href="index.html" class="old-site-nav-link">Splash</a></div>...dolphinback...</a>
old_nav_count = html.count('old-site-nav-link')
gif_cluster_pattern = r'<div class="photo-grid-item"><a href="index\.html" class="old-site-nav-link">Splash</a></div>.*?</figure></div></a>'
html = re.sub(gif_cluster_pattern, '', html, flags=re.DOTALL)
new_old_nav_count = html.count('old-site-nav-link')
if new_old_nav_count < old_nav_count:
    fixed.append('removed GIF nav cluster (dolphinback + menu GIFs)')

write(fn, html)
results[fn] = {'fixed': fixed, 'remaining_old_nav': html.count('old-site-nav-link')}

# ─────────────────────────────────────────────────────────────────────────────
# GROUP 4: janus00x.html — GIF nav cluster (no old-site-nav-link class, uses menusplash.gif) + self-ref href
# ─────────────────────────────────────────────────────────────────────────────
fn = 'janus00x.html'
html = read(fn)
fixed = []

# Fix 1: archive-notice self-ref href
p = rf'href="{re.escape(fn)}" rel="noopener" (data-original-href="http://www\.johnclilly\.com/{re.escape(fn)}")'
r = rf'href="http://www.johnclilly.com/{fn}" target="_blank" rel="noopener" \1'
new = re.sub(p, r, html)
if new != html:
    fixed.append('archive-notice self-ref href fixed')
    html = new

# Fix 2: Remove GIF nav cluster
# Starts with: <a href="index.html"><div class="photo-grid-item"><img src="...menusplash.gif"...
# Ends with: </figure></div></a>  (the dolphinback figure)
dolphin_before = html.count('dolphinback')
gif_cluster_pattern = r'<a href="index\.html"><div class="photo-grid-item"><img src="[^"]*menusplash\.gif[^"]*".*?</figure></div></a>'
html = re.sub(gif_cluster_pattern, '', html, flags=re.DOTALL)
dolphin_after = html.count('dolphinback')
if dolphin_after < dolphin_before:
    fixed.append('removed GIF nav cluster (menusplash + dolphinback)')

write(fn, html)
results[fn] = {'fixed': fixed, 'remaining_dolphinback': html.count('dolphinback')}

# ─────────────────────────────────────────────────────────────────────────────
# GROUP 5: accountsx.html — text old-nav-links + self-ref href
# ─────────────────────────────────────────────────────────────────────────────
fn = 'accountsx.html'
html = read(fn)
fixed = []

# Fix 1: archive-notice self-ref href
p = rf'href="{re.escape(fn)}" rel="noopener" (data-original-href="http://www\.johnclilly\.com/{re.escape(fn)}")'
r = rf'href="http://www.johnclilly.com/{fn}" target="_blank" rel="noopener" \1'
new = re.sub(p, r, html)
if new != html:
    fixed.append('archive-notice self-ref href fixed')
    html = new

# Fix 2: Remove text old-nav-links block
# Pattern: <p> <a href="...">Splash</a><a href="...">What's New</a>...</p><a href="...">Back</a>
old_count_before = html.count('old-site-nav-link')
html = re.sub(
    r'<p>\s*<a href="[^"]*" class="old-site-nav-link">Splash</a>.*?</p><a href="[^"]*" class="old-site-nav-link">Back</a>\s*',
    '',
    html,
    flags=re.DOTALL
)
old_count_after = html.count('old-site-nav-link')
if old_count_after < old_count_before:
    fixed.append(f'removed text old-site-nav-links (Splash/What\'s New/Home/Outline/Back)')

write(fn, html)
results[fn] = {'fixed': fixed, 'remaining_old_nav': html.count('old-site-nav-link')}

# ─────────────────────────────────────────────────────────────────────────────
# GROUP 6: musicvid.html — self-ref href only
# ─────────────────────────────────────────────────────────────────────────────
fn = 'musicvid.html'
html = read(fn)
fixed = []

p = rf'href="{re.escape(fn)}" rel="noopener" (data-original-href="http://www\.johnclilly\.com/{re.escape(fn)}")'
r = rf'href="http://www.johnclilly.com/{fn}" target="_blank" rel="noopener" \1'
new = re.sub(p, r, html)
if new != html:
    fixed.append('archive-notice self-ref href fixed')
    html = new

write(fn, html)
results[fn] = {'fixed': fixed}

# ─────────────────────────────────────────────────────────────────────────────
# REPORT
# ─────────────────────────────────────────────────────────────────────────────
print("=== BATCH P14 FIX REPORT ===\n")
for fn, r in results.items():
    if 'status' in r and r['status'] == 'MISSING':
        print(f"  ❌ {fn} — FILE MISSING")
    elif r.get('fixed'):
        print(f"  ✅ {fn}")
        for f in r['fixed']:
            print(f"     • {f}")
        if r.get('remaining_old_nav', 0) > 0:
            print(f"     ⚠️  remaining old-site-nav-link count: {r['remaining_old_nav']}")
        if r.get('remaining_dolphinback', 0) > 0:
            print(f"     ⚠️  remaining dolphinback count: {r['remaining_dolphinback']}")
    else:
        print(f"  ⚪ {fn} — no changes (check manually)")
        if r.get('remaining_old_nav', 0) > 0:
            print(f"     ⚠️  remaining old-site-nav-link count: {r['remaining_old_nav']}")
