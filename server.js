const express = require('express'); // import express

const app = express(); // create server instance

app.get('/', (req, res) => {
  res.send('Server is running 🚀');
});
// creates a route for homepage

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
// starts server
