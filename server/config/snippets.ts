// Named HTML snippets for the html_block type.
// Select via `snippetName` field in the block editor.
// Raw `html` field continues to work when no snippetName is set.

export const SNIPPET_MAP: Record<string, string> = {
  email_header_standard: `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
  <tr>
    <td align="center" style="padding:24px 20px;">
      <a href="https://welltolddesign.com" target="_blank" style="text-decoration:none;">
        <img src="https://cdn.welltold.design/brand/welltold-logo.png" alt="Well Told" width="140" height="auto" style="display:block;border:0;max-width:140px;" />
      </a>
    </td>
  </tr>
</table>`,

  email_footer_standard: `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0ebe7;border-top:1px solid #e0d8d2;">
  <tr>
    <td align="center" style="padding:32px 20px 24px;">
      <a href="https://welltolddesign.com" target="_blank" style="text-decoration:none;">
        <img src="https://cdn.welltold.design/brand/welltold-logo.png" alt="Well Told" width="100" height="auto" style="display:block;margin:0 auto 20px;border:0;max-width:100px;" />
      </a>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;">
        <tr>
          <td style="padding:0 10px;">
            <a href="https://www.instagram.com/welltolddesign" target="_blank" style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;text-decoration:none;">Instagram</a>
          </td>
          <td style="padding:0 2px;font-family:Arial,sans-serif;font-size:13px;color:#999999;">|</td>
          <td style="padding:0 10px;">
            <a href="https://www.pinterest.com/welltolddesign" target="_blank" style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;text-decoration:none;">Pinterest</a>
          </td>
          <td style="padding:0 2px;font-family:Arial,sans-serif;font-size:13px;color:#999999;">|</td>
          <td style="padding:0 10px;">
            <a href="https://welltolddesign.com" target="_blank" style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;text-decoration:none;">Website</a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:12px;color:#666666;line-height:1.5;text-align:center;">
        Well Told Design Ltd &middot; London, United Kingdom
      </p>
      <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#999999;line-height:1.5;text-align:center;">
        You're receiving this because you opted in at welltolddesign.com.&nbsp;
        <a href="{{unsubscribe_url}}" style="color:#666666;text-decoration:underline;">Unsubscribe</a>
      </p>
    </td>
  </tr>
</table>`,

  wt_footer: `<!-- WT Footer — WELL TOLD email footer with Klaviyo unsubscribe tags -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:0;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <!-- Shipping tagline -->
        <tr>
          <td align="center" style="background-color:#0a0a0a;padding:32px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-style:italic;color:rgba(255,255,255,0.55);letter-spacing:0.02em;line-height:1.5;">
            Made for you. Shipped in 1&ndash;3 days.
          </td>
        </tr>

        <!-- Badge logo -->
        <tr>
          <td align="center" style="background-color:#0a0a0a;padding:28px 32px 24px 32px;">
            <img src="https://res.cloudinary.com/welltold/image/upload/v1776112724/WT_Badge_7_White_RGB_ncfumz.png" alt="Well Told &mdash; Life-Inspired Goods" width="120" height="120" style="display:block;width:120px;height:120px;border:0;outline:none;" />
          </td>
        </tr>

        <!-- Help / wholesale -->
        <tr>
          <td align="center" style="background-color:#0a0a0a;padding:0 40px 24px 40px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:rgba(255,255,255,0.55);line-height:1.7;text-align:center;">
            Need help? Interested in Bulk Orders or Wholesale?<br>
            Email us at <a href="mailto:help@welltolddesign.com" style="color:rgba(255,255,255,0.75);text-decoration:underline;">help@welltolddesign.com</a>.
          </td>
        </tr>

        <!-- Social icons -->
        <tr>
          <td align="center" style="background-color:#0a0a0a;padding:0 32px 28px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:0 10px;vertical-align:middle;">
                  <a href="https://www.facebook.com/welltolddesign" style="text-decoration:none;">
                    <img src="https://res.cloudinary.com/welltold/image/upload/v1776113861/facebook_white_cktawb.png" alt="Facebook" width="24" height="24" style="display:block;width:24px;height:24px;border:0;" />
                  </a>
                </td>
                <td style="padding:0 10px;vertical-align:middle;">
                  <a href="https://www.instagram.com/welltolddesign" style="text-decoration:none;">
                    <img src="https://res.cloudinary.com/welltold/image/upload/v1776113861/instagram_white_ruu6p0.png" alt="Instagram" width="24" height="24" style="display:block;width:24px;height:24px;border:0;" />
                  </a>
                </td>
                <td style="padding:0 10px;vertical-align:middle;">
                  <a href="https://www.tiktok.com/@welltold" style="text-decoration:none;">
                    <img src="https://res.cloudinary.com/welltold/image/upload/v1776113861/tik-tok_white_tjazv2.png" alt="TikTok" width="24" height="24" style="display:block;width:24px;height:24px;border:0;" />
                  </a>
                </td>
                <td style="padding:0 10px;vertical-align:middle;">
                  <a href="https://www.youtube.com/@welltolddesign" style="text-decoration:none;">
                    <img src="https://res.cloudinary.com/welltold/image/upload/v1776113862/youtube_white_mxh8mp.png" alt="YouTube" width="24" height="24" style="display:block;width:24px;height:24px;border:0;" />
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="background-color:#0a0a0a;padding:0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border-top:1px solid rgba(255,255,255,0.1);font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- Legal links: style attributes MUST be on single lines or Klaviyo renders them as visible text -->
        <tr>
          <td align="center" style="background-color:#0a0a0a;padding:20px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">
            <a href="{% manage_preferences_link %}" style="color:rgba(255,255,255,0.5);text-decoration:underline;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.08em;">Subscription Preferences</a>
            <span style="color:rgba(255,255,255,0.25);padding:0 8px;">|</span>
            <a href="{% unsubscribe_link %}" style="color:rgba(255,255,255,0.5);text-decoration:underline;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.08em;">Unsubscribe</a>
          </td>
        </tr>

        <!-- Copyright + address -->
        <tr>
          <td align="center" style="background-color:#0a0a0a;padding:8px 32px 28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:rgba(255,255,255,0.28);line-height:1.8;text-align:center;">
            &copy; {% current_year %} Well Told. All rights reserved.<br>
            175 Water Street, Unit 4 Exeter, NH 03833
          </td>
        </tr>

        <!-- Wordmark watermark -->
        <tr>
          <td align="center" style="background-color:#0a0a0a;padding:4px 0 12px 0;overflow:hidden;">
            <img src="https://res.cloudinary.com/welltold/image/upload/o_8/v1776112914/WT_word_White_RGB_gvs3v3.png" alt="" width="520" style="display:block;width:100%;max-width:520px;border:0;outline:none;" />
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`,
};

export const SNIPPET_NAMES = Object.keys(SNIPPET_MAP) as (keyof typeof SNIPPET_MAP)[];
