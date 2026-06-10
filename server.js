const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post('/send-email', async (req, res) => {
  const { to, subject, body } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    await transporter.sendMail({
      from: `"CityEcoMap - EMB Lucena City" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: body,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

app.get('/', (req, res) => res.send('CityEcoMap Email Server running.'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Email server running on port ${PORT}`));