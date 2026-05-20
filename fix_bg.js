const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('minerals/src', function(filePath) {
  if (filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Replace opaque container background
    content = content.replace(/bg-\[#0d0d0f\]/g, 'bg-transparent');
    
    // Make radial gradients semi-transparent and fade to transparent
    content = content.replace(/_#1a1200_0%/g, 'rgba(26,18,0,0.5)_0%');
    content = content.replace(/_#001a12_0%/g, 'rgba(0,26,18,0.5)_0%');
    content = content.replace(/_#0d001a_0%/g, 'rgba(13,0,26,0.5)_0%');
    content = content.replace(/_#0d0d0f_(\d+)%/g, 'transparent_$1%');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated ' + filePath);
    }
  }
});
