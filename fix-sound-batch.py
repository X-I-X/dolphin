#!/usr/bin/env python3
"""
Batch P3 — sound series fix script
Fixes: archive-notice href, DCR preservation notice, breadcrumb
"""

import re
import os

B = '/home/node/.openclaw/workspace/builds/jcl-hub'

# Map: filename → (dcr_file, dcr_label, back_link_label)
pages = {
    'sound01.html':  ('peter01.dcr', 'Peter-01 vocalization recording (1965)', 'womandolph02.html'),
    'sound01x.html': ('peter01.dcr', 'Peter-01 vocalization recording (1965)', 'womandolph02x.html'),
    'sound02.html':  ('peter02.dcr', 'Peter-02 vocalization recording (1965)', 'womandolph02.html'),
    'sound02x.html': ('peter02.dcr', 'Peter-02 vocalization recording (1965)', 'womandolph02x.html'),
    'sound03.html':  ('peter03.dcr', 'Peter-03 vocalization recording (1965)', 'womandolph02.html'),
    'sound03x.html': ('peter03.dcr', 'Peter-03 vocalization recording (1965)', 'womandolph02x.html'),
    'sound04.html':  ('peter04.dcr', 'Peter-04 vocalization recording (1965)', 'womandolph02.html'),
    'sound04x.html': ('peter04.dcr', 'Peter-04 vocalization recording (1965)', 'womandolph02x.html'),
    'sound05.html':  ('peter05.dcr', 'Peter-05 vocalization recording (1965)', 'womandolph02.html'),
    'sound05x.html': ('peter05.dcr', 'Peter-05 vocalization recording (1965)', 'womandolph02x.html'),
    'sound06x.html': ('1-2-3.dcr',       '"1-2-3" counting vocalization (1965)', 'womandolph02x.html'),
    'sound07x.html': ('1-2-3-4.dcr',     '"1-2-3-4" counting vocalization (1965)', 'womandolph02x.html'),
    'sound08x.html': ('1-2-3-4-5.dcr',   '"1-2-3-4-5" counting vocalization (1965)', 'womandolph02x.html'),
    'sound09x.html': ('1-2-3-4-5-6-7.dcr', '"1-2-3-4-5-6-7" counting vocalization (1965)', 'womandolph02x.html'),
    'sound10x.html': ('a-e-i-o.dcr',     '"a-e-i-o" vowel vocalization (1965)', 'womandolph02x.html'),
    'sound11x.html': ('i-e-a.dcr',       '"i-e-a" vowel vocalization (1965)', 'womandolph02x.html'),
}

def dcr_preservation_notice(dcr_file, dcr_label, original_url):
    return f'''<div class="preservation-notice" style="background:rgba(10,77,140,0.12);border:1px solid rgba(10,77,140,0.3);border-radius:8px;padding:16px 20px;margin:16px 0;font-size:0.88rem;color:#ccd6e0;">
  <strong>🔊 Audio Preservation Notice</strong><br>
  This page originally contained a Macromedia Director audio clip (<code>{dcr_file}</code>) — <em>{dcr_label}</em> — recorded during the Margaret Howe / Peter dolphin communication experiment.<br>
  Director/Shockwave (.dcr) is a defunct format and no longer playable in modern browsers.<br>
  Original file preserved at: <a href="{original_url}" target="_blank" rel="noopener" style="color:#5bc4d4;">{original_url}</a>
</div>'''

results = {}

for fname, (dcr_file, dcr_label, back_page) in pages.items():
    fpath = os.path.join(B, fname)
    if not os.path.exists(fpath):
        results[fname] = 'MISSING'
        continue

    html = open(fpath, encoding='utf-8').read()
    fixes = []

    # 1. Fix self-referential archive-notice href
    # Pattern: href="soundXX.html" inside archive-notice block
    # We need to replace: href="soundXX.html" → href="http://www.johnclilly.com/soundXX.html"
    # But only in the archive-notice block
    old_notice = f'href="{fname}"'
    new_notice = f'href="http://www.johnclilly.com/{fname}"'
    if old_notice in html:
        html = html.replace(old_notice, new_notice, 1)
        fixes.append(f'fixed archive-notice href → johnclilly.com/{fname}')

    # 2. Replace DCR embed with preservation notice
    original_dcr_url = f'http://www.johnclilly.com/{dcr_file}'
    embed_pattern = re.compile(r'<embed[^>]+src="' + re.escape(dcr_file) + r'"[^>]*>', re.IGNORECASE)
    if embed_pattern.search(html):
        notice = dcr_preservation_notice(dcr_file, dcr_label, original_dcr_url)
        html = embed_pattern.sub(notice, html, count=1)
        fixes.append(f'replaced DCR embed ({dcr_file}) with preservation notice')
    elif dcr_file in html:
        fixes.append(f'WARNING: dcr_file {dcr_file} found but embed pattern did not match')

    # 3. Fix breadcrumb: "Writings" → "Interspecies > Woman & Dolphin Diary"
    old_bc = '<a href="writings.html">Writings</a><span>›</span>PHOTOS:  Margaret Howe and Peter Dolphin, 1965'
    new_bc = '<a href="interspeciesx.html">Interspecies</a><span>›</span><a href="womandolph01x.html">Woman &amp; Dolphin Diary</a><span>›</span>PHOTOS: Margaret Howe and Peter Dolphin, 1965'
    if old_bc in html:
        html = html.replace(old_bc, new_bc, 1)
        fixes.append('fixed breadcrumb: Writings → Interspecies > Woman & Dolphin Diary')
    # Also handle slight variant without extra spaces
    old_bc2 = '<a href="writings.html">Writings</a><span>›</span>PHOTOS: Margaret Howe and Peter Dolphin, 1965'
    if old_bc2 in html:
        html = html.replace(old_bc2, new_bc, 1)
        fixes.append('fixed breadcrumb (variant): Writings → Interspecies > Woman & Dolphin Diary')

    open(fpath, 'w', encoding='utf-8').write(html)
    results[fname] = fixes

# Print results
for fname, res in results.items():
    print(f"\n{fname}:")
    if isinstance(res, list):
        for f in res:
            print(f"  ✓ {f}")
    else:
        print(f"  {res}")

print("\nDone.")
