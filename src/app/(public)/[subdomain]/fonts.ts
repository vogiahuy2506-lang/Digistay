// The website builder's font choices (Inter and Playfair Display come from the
// root layout), self-hosted from npm (@fontsource) rather than fetched from
// Google at build time (see src/styles/fonts.css). Each face carries a
// unicode-range, so a browser only downloads the fonts and subsets a site
// actually shows. Every one has the Vietnamese subset; Lato and Poppins did
// not and are mapped to Nunito Sans / Be Vietnam Pro (see font-stack.ts).
import '@fontsource-variable/roboto/wght.css'
import '@fontsource-variable/open-sans/wght.css'
import '@fontsource-variable/nunito-sans/wght.css'
import '@fontsource-variable/merriweather/wght.css'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import '@fontsource-variable/montserrat/wght.css'
import './fonts.css'

/** The class that defines the site fonts' CSS variables (fonts.css). */
export const siteFontVariables = 'site-fonts'
