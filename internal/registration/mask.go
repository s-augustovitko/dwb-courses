package registration

import "strings"

const (
	maskChar         = "*"
	maskedEmailStars = 3
)

func maskTail(value string, visible int) string {
	runes := []rune(value)
	if len(runes) <= visible {
		return strings.Repeat(maskChar, len(runes))
	}

	return strings.Repeat(
		maskChar,
		len(runes)-visible,
	) + string(
		runes[len(runes)-visible:],
	)
}

// maskEmail keeps the first letter of the name and the full domain.
func maskEmail(email string) string {
	name, domain, found := strings.Cut(email, "@")
	if !found || name == "" {
		return maskTail(email, 0)
	}

	return string(
		[]rune(name)[:1],
	) + strings.Repeat(
		maskChar,
		maskedEmailStars,
	) + "@" + domain
}
