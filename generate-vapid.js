const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();

console.log('PUBLIC KEY:');
console.log(keys.publicKey);

console.log('PRIVATE KEY:');
console.log(keys.privateKey);
