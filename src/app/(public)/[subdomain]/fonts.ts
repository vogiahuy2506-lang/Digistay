import { Lato, Merriweather, Montserrat, Open_Sans, Poppins, Roboto } from 'next/font/google'

// The website builder's font choices (Inter and Playfair Display come from the
// root layout). preload: false — a font file is only fetched by sites that
// use it. Lato and Poppins have no Vietnamese subset (see font-stack.ts).
const roboto = Roboto({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '700'], variable: '--font-roboto', display: 'swap', preload: false })
const openSans = Open_Sans({ subsets: ['latin', 'vietnamese'], variable: '--font-open-sans', display: 'swap', preload: false })
const lato = Lato({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'], variable: '--font-lato', display: 'swap', preload: false })
const merriweather = Merriweather({ subsets: ['latin', 'vietnamese'], weight: ['400', '700'], variable: '--font-merriweather', display: 'swap', preload: false })
const poppins = Poppins({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-poppins', display: 'swap', preload: false })
const montserrat = Montserrat({ subsets: ['latin', 'vietnamese'], variable: '--font-montserrat', display: 'swap', preload: false })

export const siteFontVariables = [roboto, openSans, lato, merriweather, poppins, montserrat].map((f) => f.variable).join(' ')
