import definitions from "@/locales/legacy-patterns.json";
import { t, type MessageParameters } from "./catalog";
import type { SiteLocale } from "./site-locales";

const rules = definitions.rules.map((rule) => ({ ...rule, matcher: new RegExp(rule.regex) }));
const endings: Record<string, string> = {
  "": "none", "/month, billed annually": "annual", "/month, cancel anytime": "monthly",
  " per month": "perMonth", " per month, billed annually": "perMonthAnnual", " per month, cancel anytime": "perMonthMonthly",
  ", including the current image unlock": "unlock", " valid for one year": "year", ", no subscription": "noSubscription",
  " for watermarked creation": "watermarked", " included": "included"
};
const tokenKeys = definitions.tokens as Record<string, string>;

/** Match existing interpolated English strings without storing translations in code. */
export function translateFunctionalPattern(text: string, locale: SiteLocale): string | undefined {
  let match = text.match(/^(\d[\d,]*) (paid |free |bonus |one-time |video )?credits?(.*)$/i);
  if (match && endings[match[3]] !== undefined) {
    const type = match[2]?.trim().toLowerCase() || (Number(match[1].replaceAll(",", "")) === 1 ? "singular" : "standard");
    return t(locale, "workbench.credits.quantity", { count: match[1], noun: t(locale, `workbench.credits.types.${type}`), ending: t(locale, `workbench.credits.endings.${endings[match[3]]}`) });
  }
  match = text.match(/^(\d[\d,]*) (Image Credits|Credit Pack|Image Credit Pack)$/);
  if (match) return t(locale, `workbench.credits.${match[2] === "Image Credits" ? "imageQuantity" : match[2] === "Credit Pack" ? "pack" : "imagePack"}`, { count: match[1] });
  match = text.match(/^Up to (about |~)?(\d[\d,]*) (HD images|videos|video generations)(\/month| total)?$/);
  if (match) return t(locale, "workbench.capacity.summary", { count: match[2], approx: match[1] ? t(locale, "workbench.tokens.approximate") : "", noun: t(locale, `workbench.tokens.${match[3] === "HD images" ? "hdImages" : match[3] === "videos" ? "videos" : "videoGenerations"}`), period: match[4] ? t(locale, `workbench.tokens.${match[4] === "/month" ? "monthly" : "total"}`) : "" });
  match = text.match(/^Up to ~(\d[\d,]*) (HD|1K) images or ~(\d[\d,]*) videos\/month( \(720p, 5 seconds\))?$/);
  if (match) return t(locale, "workbench.capacity.mixed", { images: match[1], type: match[2], videos: match[3], details: match[4] ? t(locale, "workbench.tokens.videoDetails") : "" });
  match = text.match(/^Save (up to )?(\d+)%$/);
  if (match) return t(locale, "workbench.savings.percent", { prefix: match[1] ? t(locale, "workbench.tokens.upTo") : "", percent: match[2] });
  match = text.match(/^We sent a 6-digit code to (.+)\.$/);
  if (match) return t(locale, "workbench.auth.codeSent", { email: match[1] });
  match = text.match(/^A one-year credit pack for up to about (\d+) HD images\.$/);
  if (match) return t(locale, "workbench.credits.yearPackDescription", { count: match[1] });
  match = text.match(/^(Basic|Pro|Max|Video Basic|Video Standard|Video Ultimate) (Annual|Monthly)$/);
  if (match) return t(locale, "workbench.plans.period", { name: match[1].replace("Video", t(locale, "workbench.plans.video")), period: t(locale, `workbench.plans.${match[2].toLowerCase()}`) });
  match = text.match(/^(.+) [Tt]emplate( \| Vismuse)?$/);
  if (match) return t(locale, "common.template.title", { name: match[1], suffix: match[2] ?? "" });
  match = text.match(/^Customize the (.+) template in Vismuse and generate editable AI artwork for your project\.$/);
  if (match) return t(locale, "common.template.description", { name: match[1] });
  match = text.match(/^Save ([$€£].+)$/);
  if (match) return t(locale, "workbench.savings.amount", { price: match[1] });
  match = text.match(/^(Featured on|Listed on|Verified on|Powered by) (.+)$/);
  if (match) {
    const key = { "Featured on": "featured", "Listed on": "listed", "Verified on": "verified", "Powered by": "powered" }[match[1]];
    return t(locale, `workbench.listing.${key}`, { name: match[2] });
  }
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index];
    const values = text.match(rule.matcher);
    if (!values) continue;
    const parameters: MessageParameters = {};
    rule.params.forEach((name, index) => {
      const value = values[index + 1] ?? "";
      parameters[name] = tokenKeys[value] ? t(locale, tokenKeys[value]) : translateFunctionalPattern(value, locale) ?? value;
    });
    if (rule.approximateParam) parameters.approx = String(parameters[rule.approximateParam]).startsWith("~") ? t(locale, "workbench.tokens.approximate") : "";
    if (rule.stripApproximate) parameters.n = String(parameters.n).replace("~", "");
    if (rule.translateExtra && parameters.extra === " · No video generation") parameters.extra = t(locale, "workbench.tokens.noVideoGeneration");
    return t(locale, rule.key, parameters);
  }
}
