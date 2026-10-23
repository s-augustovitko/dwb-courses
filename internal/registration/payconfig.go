package registration

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
)

type paymentConfigResponse struct {
	Enabled      bool   `json:"enabled"`
	Provider     string `json:"provider"`
	PublicKey    string `json:"publicKey"`
	RSAID        string `json:"rsaId"`
	RSAPublicKey string `json:"rsaPublicKey"`
}

// PaymentConfig tells the browser how to start an online payment; it never
// includes a secret.
// The optional RSA pair is returned only when both halves are set.
func (s server) PaymentConfig(c fiber.Ctx) error {
	culqiCfg := s.Cfg().Culqi

	rsaID, rsaPublicKey := "", ""
	if culqiCfg.RSAID != "" && culqiCfg.RSAPublicKey != "" {
		rsaID, rsaPublicKey = culqiCfg.RSAID, culqiCfg.RSAPublicKey
	}

	return api.Success(c, paymentConfigResponse{
		Enabled:      culqiCfg.PublicKey != "" && culqiCfg.SecretKey != "",
		Provider:     s.gateway.Provider(),
		PublicKey:    culqiCfg.PublicKey,
		RSAID:        rsaID,
		RSAPublicKey: rsaPublicKey,
	})
}
