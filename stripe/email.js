/**
 * License key delivery email (Application layer).
 * Resend API preferred; logs to console if not configured.
 */

export async function sendLicenseKeyEmail(to, key, tier = 'pro') {
  if (!to) {
    console.warn('License email skipped: no recipient email on checkout session.');
    return { sent: false, reason: 'no_email' };
  }

  const isAgency = tier === 'agency';
  const from = process.env.EMAIL_FROM || 'RedzeUX <onboarding@resend.dev>';
  const subject = isAgency ? 'Your RedzeUX Agency kit license key' : 'Your RedzeUX Pro license key';
  const tierLine = isAgency
    ? '<p>Your <strong>Agency (Kit)</strong> license includes white-label deliverables and compare. Maintenance renews annually.</p>'
    : '<p>Your <strong>Pro (Teardown)</strong> subscription includes unlimited briefs, compare, and client exports.</p>';

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;">
  <h1 style="color:#4858c8;">RedzeUX ${isAgency ? 'Agency' : 'Pro'}</h1>
  <p>Thank you. Here is your license key:</p>
  <p style="font-size:18px;font-weight:700;letter-spacing:0.04em;background:#f0f2ff;padding:12px 16px;border-radius:8px;">${key}</p>
  ${tierLine}
  <ol>
    <li>Open the <strong>RedzeUX</strong> Chrome extension</li>
    <li>Go to <strong>Options</strong></li>
    <li>Paste your key → <strong>Save &amp; verify key</strong></li>
  </ol>
  <p style="color:#555;font-size:13px;"><em>RedzeUX suggests. You synthesize. You decide.</em></p>
</body></html>`;

  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html
        })
      });
      if (!response.ok) {
        const text = await response.text();
        console.error('Resend email failed:', response.status, text);
        return { sent: false, reason: 'resend_error', detail: text };
      }
      console.log(`License email sent to ${to}`);
      return { sent: true, provider: 'resend' };
    } catch (error) {
      console.error('Resend email error:', error.message);
      return { sent: false, reason: 'resend_exception', detail: error.message };
    }
  }

  console.log('--- RedzeUX license email (EMAIL NOT CONFIGURED) ---');
  console.log(`To: ${to}`);
  console.log(`Key: ${key}`);
  console.log('Set RESEND_API_KEY and EMAIL_FROM in .env to send automatically.');
  return { sent: false, reason: 'not_configured', key };
}
