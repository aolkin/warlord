/**
 * plugins/webfontloader.ts
 *
 * webfontloader documentation: https://github.com/typekit/webfontloader
 */

export async function loadFonts() {
  const webFontLoader = await import(/* webpackChunkName: "webfontloader" */"webfontloader")

  webFontLoader.load({
    google: {
      families: [
        "Roboto:100,300,400,500,700,900",
        "Fanwood Text:400", // Simple Serifs
        "Fondamento:400",
        "Eczar:400,500,600,700,800",
        "Merriweather:400,700,900",
        "Neuton:400,700,800",
        "Pirata One:400", // Fancy but harder to read
        "Quintessential:400", // Primary for Masterboard
        "Frank Ruhl Libre:400,500,700,900", // Primary for creatures
        "Redressed:400&display=swap" // &display=swap must be included on only the last family
      ]
    }
  })
}
