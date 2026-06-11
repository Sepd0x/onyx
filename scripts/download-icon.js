const https = require('https');
const fs = require('fs');

fs.mkdirSync('assets', {recursive:true});
const file = fs.createWriteStream('assets/icon.png');
// Downloading a standard 32-bit PNG to avoid VipsForeignLoad errors in electron-builder
https.get('https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Typescript_logo_2020.svg/256px-Typescript_logo_2020.svg.png', function(response) {
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Standard PNG Icon downloaded.');
  });
});
