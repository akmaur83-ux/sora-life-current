# Sora Life brand assets

## Official header logo

Save the uploaded logo file here, named exactly:

    assets/sora-life-logo.png

- The header (`src/components/Logo.jsx`) loads it from `/assets/sora-life-logo.png`.
- Until the file exists, the header falls back to the built-in SVG sparrow wordmark.
- **Use a transparent-background PNG** (or SVG). The uploaded artwork sits on a
  solid black background; on the light ivory navbar a transparent export looks
  correct, whereas the black-background version would render as a dark box.
- Any width works — it is sized by CSS to 48px tall on desktop / 34px on mobile
  (aspect ratio preserved, so the navbar height does not change).

To use a different filename or an SVG, update `LOGO_SRC` at the top of
`src/components/Logo.jsx`.
