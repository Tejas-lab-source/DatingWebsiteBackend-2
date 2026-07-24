const Brevo = require("@getbrevo/brevo");

const apiInstance = new Brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

function otpTemplate(otp) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff;border-radius:16px;border:1px solid #eee">
    <h2 style="color:#e11d48">JIIT Connections</h2>

    <p>Your verification code is:</p>

    <div style="
      font-size:34px;
      font-weight:bold;
      letter-spacing:8px;
      text-align:center;
      background:#fff1f2;
      color:#e11d48;
      padding:20px;
      border-radius:10px;
    ">
      ${otp}
    </div>

    <p style="margin-top:20px">
      This code expires in 10 minutes.
    </p>
  </div>`;
}

async function sendOtpEmail(to, otp) {
  const email = new Brevo.SendSmtpEmail();

  email.subject = `${otp} is your JIIT Connections verification code`;

  email.sender = {
    name: "JIIT Connections",
    email: process.env.EMAIL_FROM,
  };

  email.to = [
    {
      email: to,
    },
  ];

  email.htmlContent = otpTemplate(otp);

  return apiInstance.sendTransacEmail(email);
}

module.exports = {
  sendOtpEmail,
};