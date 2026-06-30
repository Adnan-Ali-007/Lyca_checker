const fs = require('fs');
const http = require('http');

const filePath = __dirname + '/test_mock.txt';
const fileContent = fs.readFileSync(filePath);
const boundary = '----FormBoundary' + Date.now();

const body = Buffer.concat([
  Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="test_mock.txt"\r\nContent-Type: text/plain\r\n\r\n'),
  fileContent,
  Buffer.from('\r\n--' + boundary + '--\r\n')
]);

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/upload',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': body.length
  }
};

console.log('Sending', fileContent.length, 'bytes to backend...');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data);
  });
});
req.on('error', e => console.error('ERROR:', e.message));
req.write(body);
req.end();
