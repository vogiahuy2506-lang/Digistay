import { Be_Vietnam_Pro, Merriweather, Montserrat, Nunito_Sans, Open_Sans, Roboto } from 'next/font/google'

// The website builder's font choices (Inter and Playfair Display come from the
// root layout). preload: false — a font file is only fetched by sites that
// use it. Every one has the Vietnamese subset; Lato and Poppins did not and
// are mapped to Nunito Sans / Be Vietnam Pro (see font-stack.ts).
const roboto = Roboto({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '700'], variable: '--font-roboto', display: 'swap', preload: false })
const openSans = Open_Sans({ subsets: ['latin', 'vietnamese'], variable: '--font-open-sans', display: 'swap', preload: false })
const nunitoSans = Nunito_Sans({ subsets: ['latin', 'vietnamese'], variable: '--font-nunito-sans', display: 'swap', preload: false })
const merriweather = Merriweather({ subsets: ['latin', 'vietnamese'], weight: ['400', '700'], variable: '--font-merriweather', display: 'swap', preload: false })
const beVietnamPro = Be_Vietnam_Pro({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700'], variable: '--font-be-vietnam-pro', display: 'swap', preload: false })
const montserrat = Montserrat({ subsets: ['latin', 'vietnamese'], variable: '--font-montserrat', display: 'swap', preload: false })

export const siteFontVariables = [roboto, openSans, nunitoSans, merriweather, beVietnamPro, montserrat].map((f) => f.variable).join(' ')
