'use strict';
require('dotenv').config();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('<h1>ChEmIcally Active Portal</h1><p>Site is working! 🎉</p><p><a href="/admin">Go to Admin</a></p>');
});

app.get('/admin', (req, res) => {
  res.send('<h1>Admin Panel</h1><p>Login coming soon...</p>');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
