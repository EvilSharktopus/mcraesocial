import urllib.request
import urllib.parse
import re
import json

drills = [
    'dragon tails soccer drill',
    'wreck it ralph soccer drill',
    'british bulldog soccer drill',
    'animal game soccer drill',
    'pirates soccer drill',
    'shark attack soccer drill',
    'runaway soccer drill',
    'alien invasion soccer drill',
    'hungry hippos soccer drill',
    'clean your room soccer drill',
    'nuts & squirrels soccer drill',
    'dont feed the monkeys soccer drill',
    'ball tag soccer drill'
]

html_parser = re.compile(r'href=\"[^\"]*v=([a-zA-Z0-9_-]{11})[^\"]*\"')

results = {}
for drill in drills:
    url = 'https://html.duckduckgo.com/html/?q=' + urllib.parse.quote('site:youtube.com ' + drill)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        match = html_parser.search(html)
        if match:
            results[drill] = match.group(1)
        else:
            results[drill] = ''
    except Exception as e:
        results[drill] = str(e)

print(json.dumps(results, indent=2))
