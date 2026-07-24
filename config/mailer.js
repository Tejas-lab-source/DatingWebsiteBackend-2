const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

function otpTemplate(otp) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff;border-radius:16px;border:1px solid #eee">
    <h2 style="color:#e11d48">JIIT Connections</h2>
    <p>Your verification code is:</p>
    <div style="font-size:34px;font-weight:bold;letter-spacing:8px;text-align:center;background:#fff1f2;color:#e11d48;padding:20px;border-radius:10px">
      ${otp}
    </div>
    <p style="margin-top:20px">This code expires in 10 minutes.</p>
  </div>`;
}

async function sendOtpEmail(to, otp) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not set');
  if (!process.env.EMAIL_FROM) throw new Error('EMAIL_FROM is not set');

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'JIIT Connections', email: process.env.EMAIL_FROM },
      to: [{ email: to }],
      subject: `${otp} is your JIIT Connections verification code`,
      htmlContent: otpTemplate(otp),
      textContent: `Your JIIT Connections verification code is ${otp}. It expires in 10 minutes.`,
    }),
  });

  if (!res.ok) {
    // Brevo returns JSON like { code: 'unauthorized', message: '...' }
    const body = await res.text();
    throw new Error(`Brevo ${res.status}: ${body}`);
  }

  return res.json();
}

module.exports = { sendOtpEmail };
