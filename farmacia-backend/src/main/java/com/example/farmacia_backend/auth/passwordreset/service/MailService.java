package com.example.farmacia_backend.auth.passwordreset.service;

import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class MailService {

  private final JavaMailSender mailSender;

  // Usar el mismo correo configurado en spring.mail.username (Gmail)
  @Value("${spring.mail.username}")
  private String fromEmail;

  @Value("${app.mail.from-name:Absolute}")
  private String fromName;

  // Ruta del logo dentro del backend (classpath)
  @Value("${app.brand.logo-path:static/brand/absolute-blanco-logo.png}")
  private String logoPath;

  public MailService(JavaMailSender mailSender) {
    this.mailSender = mailSender;
  }

  public void sendResetCode(String to, String code) {
    try {
      MimeMessage mimeMessage = mailSender.createMimeMessage();
      MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

      helper.setTo(to);
      helper.setSubject("Recuperación de contraseña - Absolute");
      helper.setFrom(fromEmail, fromName);

      // HTML usando CID para imagen embebida
      String html = buildResetHtml(code);
      helper.setText(html, true);

      // Adjuntar imagen inline
      ClassPathResource logo = new ClassPathResource(logoPath);
      helper.addInline("absoluteLogo", logo);

      mailSender.send(mimeMessage);
      return;

    } catch (Exception ex) {
      // fallback texto plano
      SimpleMailMessage msg = new SimpleMailMessage();
      msg.setTo(to);
      msg.setSubject("Recuperación de contraseña - Absolute");
      msg.setText(
          "Tu código de recuperación es: " + code + "\n\n" +
          "Este código vence en 10 minutos.\n" +
          "Si no solicitaste esto, ignora este correo."
      );
      mailSender.send(msg);
    }
  }

  private String buildResetHtml(String code) {
    return """
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin:0; padding:0; background:#f5f7fb; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#f5f7fb; padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="560" cellspacing="0" cellpadding="0"
                     style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,.08);">
                
                <!-- Header -->
                <tr>
                  <td align="center" style="padding:26px 20px 10px 20px; background:#0b1220;">
                    <img src="cid:absoluteLogo" alt="Absolute" width="140"
                         style="display:block; margin:0 auto; max-width:140px;" />
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td align="center" style="padding:26px 26px 8px 26px;">
                    <h2 style="margin:0; font-size:20px; color:#0f172a; text-align:center;">
                      Recuperación de contraseña
                    </h2>
                    <p style="margin:10px 0 0 0; font-size:14px; color:#475569; line-height:1.5; text-align:center;">
                      Usa este código para restablecer tu contraseña.
                    </p>
                  </td>
                </tr>

                <!-- Code -->
                <tr>
                  <td align="center" style="padding:14px 26px 8px 26px;">
                    <div style="
                      display:inline-block;
                      background:#eef2ff;
                      border:1px solid #c7d2fe;
                      color:#1e1b4b;
                      font-weight:700;
                      letter-spacing:6px;
                      font-size:28px;
                      padding:14px 18px;
                      border-radius:14px;
                      text-align:center;
                    ">
                      %s
                    </div>
                    <p style="margin:12px 0 0 0; font-size:12px; color:#64748b; text-align:center;">
                      Este código vence en <b>10 minutos</b>.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="padding:18px 26px 26px 26px;">
                    <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.6; text-align:center;">
                      Si no solicitaste esta acción, puedes ignorar este correo.
                    </p>
                    <p style="margin:10px 0 0 0; font-size:11px; color:#cbd5e1; text-align:center;">
                      © 2026 Absolute Systems
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    """.formatted(code);
  }
}
