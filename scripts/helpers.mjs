import {
  DAYS_PER_WEEK,
  EXTRA_DAYS_PER_YEAR,
  FONT_SIZE,
  ICON_SIZE,
  MODULE,
  MONTHS_PER_YEAR,
  TOP_OFFSET,
  WEEKS_PER_MONTH
} from "./constants.mjs";
import VisualActiveEffectsEditor from "./textEditor.mjs";

/** Register the handlebar helpers. */
export function registerHelpers() {
  Handlebars.registerHelper("VAE.remainingTimeLabel", (effect) => {
    // Case 1: Duration measured in rounds and turns.
    if (effect.duration.type === "turns") {
      if (effect.duration.remaining === null) return game.i18n.localize("VISUAL_ACTIVE_EFFECTS.TIME.UNLIMITED");
      else if (effect.duration.remaining === 0) return game.i18n.localize("VISUAL_ACTIVE_EFFECTS.TIME.EXPIRED");
      return effect.duration.label;
    }

    // Case 2: Duration measured in seconds.
    else if (effect.duration.type === "seconds") {
      const SECONDS = {
        IN_ONE_ROUND: 6,
        IN_ONE_MINUTE: 60,
        IN_TWO_MINUTES: 120,
        IN_ONE_HOUR: 3600,
        IN_TWO_HOURS: 7200,
        IN_ONE_DAY: 86400,
        IN_TWO_DAYS: 172800
      };

      const daysPerWeek = game.settings.get(MODULE, DAYS_PER_WEEK) ?? 9;
      const weeksPerMonth = game.settings.get(MODULE, WEEKS_PER_MONTH) ?? 3;
      const monthsPerYear = game.settings.get(MODULE, MONTHS_PER_YEAR) ?? 12;
      const extraDaysPerYear = game.settings.get(MODULE, EXTRA_DAYS_PER_YEAR) ?? 1;

      SECONDS.IN_ONE_WEEK = SECONDS.IN_ONE_DAY * daysPerWeek;
      SECONDS.IN_TWO_WEEKS = SECONDS.IN_ONE_WEEK * 2;
      SECONDS.IN_ONE_MONTH = SECONDS.IN_ONE_WEEK * weeksPerMonth;
      SECONDS.IN_TWO_MONTHS = SECONDS.IN_ONE_MONTH * 2;
      SECONDS.IN_ONE_YEAR = SECONDS.IN_ONE_MONTH * monthsPerYear + SECONDS.IN_ONE_DAY * extraDaysPerYear;
      SECONDS.IN_TWO_YEARS = SECONDS.IN_ONE_YEAR * 2;

      const remainingSeconds = effect.duration.remaining;

      let string = "";
      let qty = 1;

      if (remainingSeconds >= SECONDS.IN_TWO_YEARS) {
        qty = Math.floor(remainingSeconds / SECONDS.IN_ONE_YEAR);
        string = "YEARS";
      } else if (remainingSeconds >= SECONDS.IN_ONE_YEAR) {
        string = "YEAR";
      } else if (remainingSeconds >= SECONDS.IN_TWO_MONTHS) {
        qty = Math.floor(remainingSeconds / SECONDS.IN_ONE_MONTH);
        string = "MONTHS";
      } else if (remainingSeconds >= SECONDS.IN_ONE_MONTH) {
        string = "MONTH";
      } else if (remainingSeconds >= SECONDS.IN_TWO_WEEKS) {
        qty = Math.floor(remainingSeconds / SECONDS.IN_ONE_WEEK);
        string = "WEEKS";
      } else if (remainingSeconds >= SECONDS.IN_ONE_WEEK) {
        string = "WEEK";
      } else if (remainingSeconds >= SECONDS.IN_TWO_DAYS) {
        qty = Math.floor(remainingSeconds / SECONDS.IN_ONE_DAY);
        string = "DAYS";
      } else if (remainingSeconds >= SECONDS.IN_ONE_DAY) {
        string = "DAY";
      } else if (remainingSeconds >= SECONDS.IN_TWO_HOURS) {
        qty = Math.floor(remainingSeconds / SECONDS.IN_ONE_HOUR);
        string = "HOURS";
      } else if (remainingSeconds >= SECONDS.IN_ONE_HOUR) {
        string = "HOUR";
      } else if (remainingSeconds >= SECONDS.IN_TWO_MINUTES) {
        qty = Math.floor(remainingSeconds / SECONDS.IN_ONE_MINUTE);
        string = "MINUTES";
      } else if (remainingSeconds >= SECONDS.IN_ONE_MINUTE) {
        string = "MINUTE";
      } else if (remainingSeconds >= 2) {
        qty = remainingSeconds;
        string = "SECONDS";
      } else if (remainingSeconds === 1) {
        string = "SECOND";
      } else {
        string = "EXPIRED";
      }

      return game.i18n.format(`VISUAL_ACTIVE_EFFECTS.TIME.${string}`, {qty});
    }

    // Case 3: Neither rounds, turns, or seconds, so just return unlimited.
    return game.i18n.localize("VISUAL_ACTIVE_EFFECTS.TIME.UNLIMITED");
  });
}

/** Render the editor. */
export function _renderEditor() {
  const editor = Object.values(this.apps).find(e => e instanceof VisualActiveEffectsEditor);
  if (editor) return editor.render();
  return new VisualActiveEffectsEditor(this).render(true);
}

/** Refreshes the style sheet when a user changes the various css-related module settings. */
export function applyStyleSettings() {
  const data = {};
  data["icon-size"] = Math.max(10, Math.round(game.settings.get(MODULE, ICON_SIZE) || 50));
  data["font-size"] = Math.max(6, Math.round(game.settings.get(MODULE, FONT_SIZE) || 16));
  data["max-width"] = Math.round(350 * data["font-size"] / 16);
  data["top-offset"] = Math.max(0, Math.round(game.settings.get(MODULE, TOP_OFFSET) || 25));
  const root = document.querySelector(":root");
  Object.entries(data).forEach(([key, val]) => root.style.setProperty(`--${MODULE}-${key}`, `${val}px`));
}

/** Register API functions. */
export function registerAPI() {
  game.modules.get(MODULE).api = {
    migrateWorldDescriptions: async function() {
      ui.notifications.info(`${MODULE.toUpperCase()} | Migrating actors and items in the sidebar. Please be patient.`);
      for (const item of game.items) await _migrateDocumentWithEffects(item);
      for (const actor of game.actors) await _migrateActor(actor);
      ui.notifications.info(`${MODULE.toUpperCase()} | Finished migrating sidebar actors and items.`);
    },
    migratePackDescriptions: async function(pack) {
      const isActor = pack.metadata.type === "Actor";
      const isItem = pack.metadata.type === "Item";
      if (!(isActor || isItem)) {
        console.warn(`${MODULE.toUpperCase()} | ${pack.metadata.label} (${pack.metadata.id}) is not a valid compendium type.`);
        return null;
      }
      ui.notifications.info(`${MODULE.toUpperCase()} | Migrating ${pack.metadata.label} (${pack.metadata.id}). Please be patient.`);
      const docs = await pack.getDocuments();
      const mig = isActor ? _migrateActor : _migrateDocumentWithEffects;
      for (const doc of docs) await mig(doc);
      ui.notifications.info(`${MODULE.toUpperCase()} | Finished migrating ${pack.metadata.label} (${pack.metadata.id}).`);
    }
  };
}

async function _migrateActor(actor) {
  await _migrateDocumentWithEffects(actor);
  for (const item of actor.items) {
    await _migrateDocumentWithEffects(item);
  }
}

async function _migrateDocumentWithEffects(doc) {
  const updates = [];
  for (const effect of doc.effects) {
    const data = effect.flags[MODULE]?.data?.intro;
    if (data) updates.push({_id: effect.id, description: data});
  }
  if (updates.length) console.log(`${MODULE.toUpperCase()} | Migrating ${doc.name} (${doc.uuid})`);
  return doc.updateEmbeddedDocuments("ActiveEffect", updates);
}
