const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = 'cityecomap.lucena@gmail.com';
const SENDER_NAME = 'CityEcoMap - EMB Lucena City';

app.post('/send-email', async (req, res) => {
  const { to, subject, body } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: body,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Brevo API error:', response.status, errorData);
      return res.status(500).json({ error: 'Failed to send email.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

app.get('/', (req, res) => res.send('CityEcoMap Email Server running.'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Email server running on port ${PORT}`));