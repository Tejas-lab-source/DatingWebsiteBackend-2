const nodemailer = require('nodemailer');

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("GMAIL_PASS:", process.env.GMAIL_PASS ? "Loaded" : "Missing");

const transporter = nodemailer.createTransport({
  host: process.env.GMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.GMAIL_PORT || 587),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
  pool: true,
  maxConnections: 3,
});

// ADD THIS BLOCK
transporter.verify((err, success) => {
  if (err) {
    console.error("========== SMTP VERIFY ERROR ==========");
    console.error(err);
    console.error("=======================================");
  } else {
    console.log("✅ SMTP server is ready");
  }
});

function otpTemplate(otp) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff;border-radius:16px;border:1px solid #eee">
    <h2 style="color:#e11d48;margin:0 0 8px">JIIT Connections</h2>
    <p style="color:#444;margin:0 0 24px">Here is your verification code.</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;background:#fff1f2;color:#e11d48;padding:18px;border-radius:12px">${otp}</div>
    <p style="color:#666;font-size:14px;margin-top:24px">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
  </div>`;
}

async function sendOtpEmail(to, otp) {
  return transporter.sendMail({
    from: `"JIIT Connections" <${process.env.EMAIL_USER}>`,
    to,
    subject: `${otp} is your JIIT Connections code`,
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
    html: otpTemplate(otp),
  });
}

module.exports = { transporter, sendOtpEmail };
