/**
 * Ambient declarations for the stylesheets imported for their side effects
 * (the font packages, the app's own CSS). Without them, TypeScript reports
 * "Cannot find module or type declarations for side-effect import" on every
 * one of those imports, because no module ships a type declaration for a
 * plain `.css` file.
 *
 * The value is never used: these imports exist for the bundler to pick up.
 */
declare module '*.css' {
  const content: string
  export default content
}
