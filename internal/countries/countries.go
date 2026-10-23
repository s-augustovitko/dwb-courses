package countries

import (
	_ "embed"
	"encoding/json"
)

//go:embed country_codes.json
var rawCountries []byte

// Country is one selectable country with its phone dial code.
type Country struct {
	Name     string `json:"name"`
	DialCode string `json:"dialCode"`
	Code     string `json:"code"`
}

// Catalog is the embedded country list with a dial code lookup.
type Catalog struct {
	list      []Country
	dialCodes map[string]bool
}

// Load parses the embedded country list.
func Load() (*Catalog, error) {
	var countries []Country
	if err := json.Unmarshal(rawCountries, &countries); err != nil {
		return nil, err
	}

	catalog := &Catalog{
		list:      countries,
		dialCodes: make(map[string]bool, len(countries)),
	}

	for _, country := range countries {
		catalog.dialCodes[country.DialCode] = true
	}

	return catalog, nil
}

// List returns a copy of the countries in file order.
func (c *Catalog) List() []Country {
	return append([]Country(nil), c.list...)
}

// IsDialCode reports whether code is a dial code present in the list.
func (c *Catalog) IsDialCode(code string) bool {
	return c.dialCodes[code]
}
