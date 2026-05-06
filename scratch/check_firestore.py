import json, urllib.request

API_KEY = 'AIzaSyB4Yc51IzKEcBzDPqy3B8fA9QSrnhIAzr4'
PROJECT = 'mcrae-assignments-ca'

url = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/assignments/SRByOZxZKT2v6NcsXTiw?key={API_KEY}'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as r:
    data = json.loads(r.read())

print(json.dumps(data.get('fields', {}), indent=2))
