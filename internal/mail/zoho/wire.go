package zoho

import (
	"encoding/base64"

	"dwb-courses/internal/mail"
)

type addressBody struct {
	Address string `json:"address"`
}

type recipientBody struct {
	EmailAddress addressBody `json:"email_address"`
}

type inlineImageBody struct {
	CID      string `json:"cid"`
	Name     string `json:"name"`
	MimeType string `json:"mime_type"`
	Content  string `json:"content"`
}

type emailBody struct {
	From         addressBody       `json:"from"`
	To           []recipientBody   `json:"to"`
	Subject      string            `json:"subject"`
	HTMLBody     string            `json:"htmlbody"`
	InlineImages []inlineImageBody `json:"inline_images,omitempty"`
}

type errorResponse struct {
	Data struct {
		ErrorCode string `json:"error_code"`
		Message   string `json:"message"`
	} `json:"data"`
}

func newEmailBody(message mail.Message) emailBody {
	images := make([]inlineImageBody, 0, len(message.InlineImages))
	for _, image := range message.InlineImages {
		images = append(images, inlineImageBody{
			CID:      image.CID,
			Name:     image.Name,
			MimeType: image.MimeType,
			Content:  base64.StdEncoding.EncodeToString(image.Content),
		})
	}

	return emailBody{
		From: addressBody{Address: message.From},
		To: []recipientBody{
			{EmailAddress: addressBody{Address: message.To}},
		},
		Subject:      message.Subject,
		HTMLBody:     message.HTML,
		InlineImages: images,
	}
}
