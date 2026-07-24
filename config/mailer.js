const nodemailer = require('nodemailer');

console.log("BREVO_USER:", process.env.BREVO_USER);
console.log("BREVO_PASS:", process.env.BREVO_PASS ? "Loaded" : "Missing");

const transporter = nodemailer.createTransport({
  host: process.env.BREVO_HOST || "smtp-relay.brevo.com",
  port: Number(process.env.BREVO_PORT || 587),
  secure: false, // Port 587 uses STARTTLS
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASS,
  },
});

transporter.verify((err, success) => {
  if (err) {
    console.error("========== BREVO SMTP VERIFY ERROR ==========");
    console.error(err);
    console.error("=============================================");
  } else {
    console.log("✅ Brevo SMTP Connected");
  }
});

function otpTemplate(otp) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff;border-radius:16px;border:1px solid #eee">
    <h2 style="color:#e11d48;margin:0 0 8px">JIIT Connections</h2>
    <p style="color:#444;margin:0 0 24px">Here is your verification code.</p>

    <div style="
      font-size:34px;
      font-weight:700;
      letter-spacing:10px;
      text-align:center;
      background:#fff1f2;
      color:#e11d48;
      padding:18px;
      border-radius:12px;
    ">
      ${otp}
    </div>

    <p style="color:#666;font-size:14px;margin-top:24px">
      This code expires in 10 minutes. If you didn't request it, you can ignore this email.
    </p>
  </div>`;
}

async function sendOtpEmail(to, otp) {
  return transporter.sendMail({
    from: `"JIIT Connections" <${process.env.EMAIL_FROM}>`,
    to,
    subject: `${otp} is your JIIT Connections verification code`,
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
    html: otpTemplate(otp),
  });
}

module.exports = {
  transporter,
  sendOtpEmail,
};
