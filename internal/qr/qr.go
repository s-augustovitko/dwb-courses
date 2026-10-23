package qr

import (
	"bytes"
	_ "embed"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"math"
	"sync"

	qrcode "github.com/skip2/go-qrcode"
)

//go:embed logo.png
var logoPNG []byte

var decodeLogo = sync.OnceValues(func() (image.Image, error) {
	return png.Decode(bytes.NewReader(logoPNG))
})

const (
	codeSizePx  = 900
	logoSizePx  = codeSizePx / 5
	badgeSizePx = logoSizePx + 28
)

// Render returns a PNG QR code of content with the logo on a white badge.
func Render(content string) ([]byte, error) {
	code, err := qrcode.New(content, qrcode.Highest)
	if err != nil {
		return nil, err
	}

	logo, err := decodeLogo()
	if err != nil {
		return nil, err
	}

	canvas := image.NewRGBA(image.Rect(0, 0, codeSizePx, codeSizePx))
	draw.Draw(
		canvas,
		canvas.Bounds(),
		code.Image(codeSizePx),
		image.Pt(0, 0),
		draw.Src,
	)
	drawLogoBadge(canvas, logo)

	var out bytes.Buffer
	if err := png.Encode(&out, canvas); err != nil {
		return nil, err
	}

	return out.Bytes(), nil
}

func drawLogoBadge(canvas draw.Image, logo image.Image) {
	badge := centeredSquare(badgeSizePx)
	draw.DrawMask(
		canvas,
		badge,
		image.White,
		image.Pt(0, 0),
		circleMask(badge),
		badge.Min,
		draw.Over,
	)
	draw.Draw(
		canvas,
		centeredSquare(logoSizePx),
		logo,
		logo.Bounds().Min,
		draw.Over,
	)
}

// circleMask is an anti-aliased circle inscribed in its bounds, used as a mask.
type circleMask image.Rectangle

func (m circleMask) ColorModel() color.Model { return color.AlphaModel }

func (m circleMask) Bounds() image.Rectangle { return image.Rectangle(m) }

func (m circleMask) At(x, y int) color.Color {
	//nolint:mnd // halving to find the center and radius
	dx, dy := float64(x)+0.5-codeSizePx/2.0, float64(y)+0.5-codeSizePx/2.0
	//nolint:mnd // halving to find the radius; +0.5 gives a one pixel wide edge
	coverage := min(1, max(0, badgeSizePx/2.0-math.Hypot(dx, dy)+0.5))

	return color.Alpha{A: uint8(coverage * math.MaxUint8)}
}

func centeredSquare(size int) image.Rectangle {
	offset := (codeSizePx - size) / 2 //nolint:mnd // halving to center

	return image.Rect(offset, offset, offset+size, offset+size)
}
