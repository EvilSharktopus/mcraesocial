import sys, requests
from bs4 import BeautifulSoup
sys.stdout.reconfigure(encoding='utf-8')
res = requests.get('https://mcraesocial.weebly.com/challenges-to-canada.html')
soup = BeautifulSoup(res.text, 'html.parser')
content = soup.find('div', class_='wsite-elements wsite-not-footer')
sections = content.find_all('div', class_='wsite-section-wrap')
print(f'Total section-wraps: {len(sections)}')
for i, sec in enumerate(sections):
    h2s = sec.find_all('h2')
    links = sec.find_all('a', href=True)
    labels = [h.get_text(separator=' ', strip=True) for h in h2s]
    print(f'Section {i}: {labels}')
    for a in links:
        txt = a.get_text(strip=True)
        if txt:
            print(f'  -> {txt}: {a["href"][:70]}')
