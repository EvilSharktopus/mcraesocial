import os
import re
import urllib.request
import urllib.error
from urllib.parse import urlparse
import time
import concurrent.futures
from html.parser import HTMLParser

class LinkExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'a' and 'href' in attrs_dict:
            self.links.append((tag, attrs_dict['href']))
        elif tag == 'link' and 'href' in attrs_dict:
            self.links.append((tag, attrs_dict['href']))
        elif tag == 'img' and 'src' in attrs_dict:
            self.links.append((tag, attrs_dict['src']))
        elif tag == 'script' and 'src' in attrs_dict:
            self.links.append((tag, attrs_dict['src']))

def check_link(link_info):
    file_path, tag, link = link_info
    
    # Ignore empty or placeholder links
    if not link or link.startswith('#') or link.startswith('mailto:') or link.startswith('tel:'):
        return None
        
    # Check external links
    if link.startswith('http://') or link.startswith('https://'):
        try:
            req = urllib.request.Request(link, headers={'User-Agent': 'Mozilla/5.0'})
            # Just do a quick HEAD request if possible, but some servers reject it
            urllib.request.urlopen(req, timeout=5)
            return None # OK
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return f"EXTERNAL 404: {link} (found in {file_path})"
            elif e.code in [401, 403, 405, 503]:
                # Many sites block automated requests, assume OK unless it's a 404
                return None
            else:
                return f"EXTERNAL {e.code}: {link} (found in {file_path})"
        except Exception as e:
            # Domain not found, timeout, etc.
            return f"EXTERNAL ERROR ({type(e).__name__}): {link} (found in {file_path})"
            
    # Check internal links
    else:
        # Remove query params and fragments
        clean_link = link.split('?')[0].split('#')[0]
        if not clean_link:
            return None
            
        base_dir = os.path.dirname(file_path)
        
        # Handle root-relative links
        if clean_link.startswith('/'):
            target_path = os.path.join(r'C:\Users\Owner\Desktop\mcraesocial', clean_link.lstrip('/'))
        else:
            target_path = os.path.join(base_dir, clean_link)
            
        target_path = os.path.normpath(target_path)
        
        # If the target path is a directory (or has no extension), check for index.html
        if not os.path.exists(target_path):
            # Try appending .html (sometimes used without extension)
            if os.path.exists(target_path + '.html'):
                return None
            # It might be a route handled by Vercel, but locally we look for index.html
            elif os.path.exists(os.path.join(target_path, 'index.html')):
                return None
            else:
                return f"LOCAL 404: {link} -> missing {target_path} (found in {file_path})"
                
    return None

def main():
    root_dir = r'C:\Users\Owner\Desktop\mcraesocial'
    html_files = []
    
    for dirpath, _, filenames in os.walk(root_dir):
        # Skip node_modules and mcrae-submit which is a react app (checked differently)
        if 'node_modules' in dirpath or '.git' in dirpath:
            continue
            
        for f in filenames:
            if f.endswith('.html'):
                html_files.append(os.path.join(dirpath, f))
                
    print(f"Found {len(html_files)} HTML files. Extracting links...")
    
    all_links = []
    for filepath in html_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            parser = LinkExtractor()
            parser.feed(content)
            for tag, link in parser.links:
                all_links.append((filepath, tag, link))
        except Exception as e:
            print(f"Error parsing {filepath}: {e}")
            
    print(f"Found {len(all_links)} links to check. Validating...")
    
    broken_links = []
    
    # We use ThreadPoolExecutor to speed up external requests
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = executor.map(check_link, all_links)
        
        for r in results:
            if r:
                broken_links.append(r)
                
    with open(r'C:\Users\Owner\Desktop\mcraesocial\scratch\broken_links.txt', 'w', encoding='utf-8') as f:
        for b in broken_links:
            f.write(b + '\n')
            
    print(f"\nDone. Found {len(broken_links)} broken links.")

if __name__ == '__main__':
    main()
