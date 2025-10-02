console.log('1. Starting test...');

console.log('2. Loading app...');
const { app, server } = require('./src/app');

console.log('3. App loaded successfully!');

const PORT = 3000;

console.log('4. Starting server...');
server.listen(PORT, () => {
  console.log(`5. Server running on port ${PORT}`);
});