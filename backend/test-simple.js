console.log('1. Starting test...');
const { app, server } = require('./src/app-simple');
console.log('2. App loaded!');

server.listen(3000, () => {
  console.log('3. Server started on port 3000');
});