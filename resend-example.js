const { Resend } = require("resend");
require("dotenv").config();

if (!process.env.RESEND_API_KEY) {
  throw new Error("Missing RESEND_API_KEY in environment variables.");
}

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendFirstEmail() {
  await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "hola@carlosmakes.com",
    subject: "Hello World",
    html: `
      <p>Congrats on sending your first email!</p>
    `,
  });
}

sendFirstEmail().then(() => {
  console.log("Email sent successfully.");
}).catch((error) => {
  console.error("Failed to send email:", error);
  process.exitCode = 1;
});
