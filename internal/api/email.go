package api

import (
	"context"
	"fmt"
	"strings"

	"github.com/matcornic/hermes/v2"

	"dwb-courses/internal/mail"
)

const (
	// AmountColumn is the summary table column that is right-aligned.
	AmountColumn = "Monto"
	// NameColumn is the summary table column holding the line description.
	NameColumn = "Concepto"
	// QRMarker is replaced by the embedded QR image when content carries one.
	QRMarker = "[[QR]]"

	qrContentID = "qr"
	qrImageHTML = `<img src="cid:qr" alt="Código QR" width="240" ` +
		`height="240" style="display:block;margin:0 auto" />`
)

// EmailContent describes a registration email: greeting, intros, an optional
// summary table, a call-to-action button (when Link is set) and a QR image.
type EmailContent struct {
	To         string
	Subject    string
	Name       string
	Intros     []string
	Table      [][]hermes.Entry
	ActionText string
	Link       string
	QRPNG      []byte
}

// SendRegistrationEmail renders content with the email template and sends it.
func SendRegistrationEmail(
	ctx context.Context,
	deps MailDeps,
	content EmailContent,
) error {
	html, err := renderRegistrationEmail(deps, content)
	if err != nil {
		return err
	}

	return sendMailMessage(
		ctx,
		deps,
		content.To,
		content.Subject,
		html,
		content.QRPNG,
	)
}

func renderRegistrationEmail(
	deps MailDeps,
	content EmailContent,
) (string, error) {
	var table hermes.Table
	if content.Table != nil {
		table = hermes.Table{
			Data: content.Table,
			Columns: hermes.Columns{
				CustomWidth:     map[string]string{},
				CustomAlignment: map[string]string{AmountColumn: "right"},
			},
		}
	}

	html, err := deps.Mailer().GenerateHTML(hermes.Email{
		Body: hermes.Body{
			Name:         content.Name,
			Intros:       content.Intros,
			Greeting:     deps.Cfg().Email.Greeting,
			Signature:    deps.Cfg().Email.Signature,
			Table:        table,
			Dictionary:   []hermes.Entry{},
			Title:        "",
			FreeMarkdown: "",
			Actions:      emailActions(deps, content),
			Outros: []string{
				fmt.Sprintf(
					"¿Necesitas ayuda o tienes alguna pregunta? "+
						"Manda un correo a %s y con gusto te ayudaremos.",
					deps.Cfg().Email.Reply,
				),
			},
		},
	})
	if err != nil {
		return "", err
	}

	if content.QRPNG != nil {
		html = strings.Replace(html, QRMarker, qrImageHTML, 1)
	}

	return html, nil
}

func emailActions(deps MailDeps, content EmailContent) []hermes.Action {
	if content.Link == "" {
		return nil
	}

	return []hermes.Action{{
		Instructions: "Haz clic aquí:",
		InviteCode:   "",
		Button: hermes.Button{
			Color:     deps.Cfg().Templates.PrimaryColor,
			TextColor: deps.Cfg().Templates.OnPrimaryColor,
			Text:      content.ActionText,
			Link:      content.Link,
		},
	}}
}

// SendEmail sends an html email based on the to, subject and body.
func SendEmail(
	ctx context.Context,
	deps MailDeps,
	to, subject, body string,
) error {
	return sendMailMessage(ctx, deps, to, subject, body, nil)
}

func sendMailMessage(
	ctx context.Context,
	deps MailDeps,
	to, subject, body string,
	qr []byte,
) error {
	return deps.Mailer().Send(ctx, mail.Message{
		From:         deps.Cfg().Email.From,
		To:           to,
		Subject:      subject,
		HTML:         body,
		InlineImages: qrInlineImages(qr),
	})
}

func qrInlineImages(qr []byte) []mail.InlineImage {
	if qr == nil {
		return nil
	}

	return []mail.InlineImage{{
		CID:      qrContentID,
		Name:     "qr.png",
		MimeType: "image/png",
		Content:  qr,
	}}
}
