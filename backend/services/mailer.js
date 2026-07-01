const nodemailer = require('nodemailer')

// Reusable transporter — configured from .env
const transporter = nodemailer.createTransport({
  service: process.env.MAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // use an App Password for Gmail
  },
})

/**
 * Notify the admin that a new user has requested access.
 * The email contains approve/reject links.
 */
async function notifyAdminNewSignup({ name, email, userId }) {
  const base = process.env.BACKEND_URL || `http://localhost:${process.env.PORT}`
  const approveUrl = `${base}/api/auth/approve/${userId}`
  const rejectUrl  = `${base}/api/auth/reject/${userId}`

  await transporter.sendMail({
    from: `"Number Validator App" <${process.env.MAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `Access Request: ${name} wants to join`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <h2 style="color:#6c63ff">New Access Request</h2>
        <p><strong>${name}</strong> (${email}) has requested access to the Number Validator app.</p>
        <p style="margin-top:24px">
          <a href="${approveUrl}"
             style="background:#22c55e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-right:12px">
            ✅ Approve
          </a>
          <a href="${rejectUrl}"
             style="background:#ef4444;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
            ❌ Reject
          </a>
        </p>
        <p style="color:#888;margin-top:24px;font-size:13px">
          These links are one-click actions — no login required.
        </p>
      </div>
    `,
  })
}

/**
 * Tell the user their account has been approved.
 */
async function notifyUserApproved({ name, email }) {
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  await transporter.sendMail({
    from: `"Number Validator App" <${process.env.MAIL_USER}>`,
    to: email,
    subject: 'Your account has been approved!',
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <h2 style="color:#6c63ff">You're in, ${name}!</h2>
        <p>Your access request has been approved. You can now log in to the Number Validator app.</p>
        <p style="margin-top:24px">
          <a href="${appUrl}/login"
             style="background:#6c63ff;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
            Log In Now
          </a>
        </p>
      </div>
    `,
  })
}

/**
 * Tell the user their account has been rejected.
 */
async function notifyUserRejected({ name, email }) {
  await transporter.sendMail({
    from: `"Number Validator App" <${process.env.MAIL_USER}>`,
    to: email,
    subject: 'Your access request was not approved',
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <h2 style="color:#ef4444">Access Not Approved</h2>
        <p>Hi ${name}, unfortunately your request to access the Number Validator app was not approved.</p>
        <p>If you think this is a mistake, please contact your administrator.</p>
      </div>
    `,
  })
}

module.exports = { notifyAdminNewSignup, notifyUserApproved, notifyUserRejected }
