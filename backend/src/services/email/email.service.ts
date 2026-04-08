import { Resend } from 'resend';
import { getEnv } from '../../lib/env';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = getEnv().RESEND_API_KEY;
  if (!apiKey) return null;
  if (!_resend) {
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export async function sendInviteEmail(
  to: string,
  name: string,
  inviteLink: string,
): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn('RESEND_API_KEY not set, skipping invite email');
    return false;
  }

  const { error } = await resend.emails.send({
    from: 'Système Éditorial <onboarding@resend.dev>',
    to,
    subject: 'Invitation - Système Éditorial',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #18181b; margin-bottom: 8px;">Bienvenue ${name} !</h2>
        <p style="color: #52525b; line-height: 1.6;">
          Vous avez été invité(e) à rejoindre le <strong>Système Éditorial</strong>.
        </p>
        <p style="color: #52525b; line-height: 1.6;">
          Cliquez sur le bouton ci-dessous pour définir votre mot de passe et activer votre compte.
          Ce lien expire dans <strong>48 heures</strong>.
        </p>
        <a href="${inviteLink}" style="display: inline-block; background: #18181b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          Définir mon mot de passe
        </a>
        <p style="color: #a1a1aa; font-size: 13px; margin-top: 24px;">
          Si le bouton ne fonctionne pas, copiez ce lien :<br/>
          <a href="${inviteLink}" style="color: #3b82f6;">${inviteLink}</a>
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send invite email:', error);
    return false;
  }
  return true;
}
