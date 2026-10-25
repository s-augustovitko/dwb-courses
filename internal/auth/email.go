package auth

import (
	"context"
	"fmt"

	"github.com/matcornic/hermes/v2"

	"dwb-courses/internal/api"
)

type emailDataCreateUser struct {
	Email    string
	Name     string
	Password string
}

const createUserSubject = "¡Bienvenido a tu cuenta DWB Admin!"

func sendCreateUserEmail(
	ctx context.Context,
	deps api.MailDeps,
	userData emailDataCreateUser,
) error {
	body, err := deps.Mailer().
		GenerateHTML(buildCreateUserEmail(deps, userData))
	if err != nil {
		return err
	}

	return api.SendEmail(ctx, deps, userData.Email, createUserSubject, body)
}

func buildCreateUserEmail(
	deps api.MailDeps,
	userData emailDataCreateUser,
) hermes.Email {
	return hermes.Email{
		Body: hermes.Body{
			Name:      userData.Name,
			Greeting:  deps.Cfg().Email.Greeting,
			Signature: deps.Cfg().Email.Signature,
			Intros: []string{
				"¡Bienvenido a DWB Admin! " +
					"Estamos muy emocionados de tenerte a bordo",
			},
			Dictionary: []hermes.Entry{
				{Key: "Usuario", Value: userData.Email},
				{Key: "Contraseña", Value: userData.Password},
			},
			Actions: []hermes.Action{
				{
					Instructions: "Para comenzar con tu cuenta, " +
						"por favor haz clic aquí:",
					Button: hermes.Button{
						Color:     deps.Cfg().Templates.PrimaryColor,
						TextColor: deps.Cfg().Templates.OnPrimaryColor,
						Text:      "Entra a tu cuenta",
						Link: deps.Cfg().Email.Link +
							deps.Cfg().Templates.AdminPath,
					},
					InviteCode: "",
				},
			},
			Outros: []string{
				fmt.Sprintf(
					"¿Necesitas ayuda o tienes alguna pregunta? "+
						"Manda un correo a %s y con gusto te ayudaremos.",
					deps.Cfg().Email.Reply,
				),
			},

			Table: hermes.Table{
				Data: [][]hermes.Entry{},
				Columns: hermes.Columns{
					CustomWidth:     map[string]string{},
					CustomAlignment: map[string]string{},
				},
			},
			Title:        "",
			FreeMarkdown: "",
		},
	}
}
