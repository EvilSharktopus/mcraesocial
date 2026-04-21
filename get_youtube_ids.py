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

results = {}
for drill in drills:
    url = 'https://www.youtube.com/results?search_query=' + urllib.parse.quote(drill)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        match = re.search(r'\"videoId\":\"([a-zA-Z0-9_-]{11})\"', html)
        if match:
            results[drill] = match.group(1)
        else:
            results[drill] = ''
    except Exception as e:
        results[drill] = str(e)

print(json.dumps(results, indent=2))
