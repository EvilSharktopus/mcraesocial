import re

ids = {
    'dragontails': 'PAtjJlBfU60',
    'wreckitralph': 'oH_dkDmGZ-U',
    'britishbulldog': 'KkTh95SX8W0',
    'animalgame': 'pHnAskgdEbk',
    'pirates': 'vCx07J6iX20',
    'sharkattack': 'w-ojctbP3D8',
    'runaway': 'IPcAL_Bry20',
    'alieninvasion': 'sWjp3zd-qKU',
    'hungryhippos': 'EbYf0ICrtAg',
    'cleanyourroom': '9QMlskAHQPI',
    'nutssquirrels': 'r-j0E8NxeQk',
    'dontfeedthemonkeys': 'OsgWbm2LrlI',
    'balltag': 'U-a1jYaN2s8'
}

with open('soccer/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

for drill_id, vid in ids.items():
    if vid:
        # Match 'id: "drill_id"', followed by anything EXCEPT '}', then 'video: "whatever"'
        pattern = r"(id:\s*'" + drill_id + r"'[^}]*?video:\s*)'[^']*'"
        content = re.sub(pattern, r"\g<1>'" + vid + "'", content, flags=re.DOTALL)

with open('soccer/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done.')
