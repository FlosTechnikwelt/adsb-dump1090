require('dotenv').config()
const express = require('express')
const app = express()
const path = require('path')
const fetch = require('node-fetch')

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))

app.get('/api/aircraft', async (req, res) => {
  try {
    const response = await fetch(process.env.DUMP1090_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching aircraft data:', error);
    res.status(500).json({ error: 'Failed to fetch aircraft data. Is dump1090 running?' });
  }
});

app.get('/', (req, res) => {
  res.render('index')
})


app.listen(process.env.port, () => {
  console.log(`Example app listening on port ${process.env.port}`)
  console.log(`http://localhost:${process.env.port}/`)
})
