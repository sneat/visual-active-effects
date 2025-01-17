import {ICON, MODULE} from "./scripts/constants.mjs";
import {registerHelpers, _renderEditor, applyStyleSettings, registerAPI} from "./scripts/helpers.mjs";
import {registerSettings} from "./scripts/settings.mjs";
import {VisualActiveEffects} from "./scripts/visual-active-effects.mjs";

Hooks.once("init", registerSettings);
Hooks.once("ready", async function() {
  await loadTemplates([
    "modules/visual-active-effects/templates/effect.hbs",
    "modules/visual-active-effects/templates/status.hbs"
  ]);
  registerHelpers();
  registerAPI();
  applyStyleSettings();
  const panel = new VisualActiveEffects();
  await panel.render(true);
  Hooks.on("collapseSidebar", panel.handleExpand.bind(panel));
  Hooks.on("updateWorldTime", panel.refresh.bind(panel, false));
  Hooks.on("controlToken", panel.refresh.bind(panel, true));
  for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
    Hooks.on(hook, function(effect) {
      if (effect.parent === panel.actor) panel.refresh(true);
    });
  }
  Hooks.on("updateCombat", function(combat, update, context) {
    if (context.advanceTime !== 0) return;
    if (!context.direction) return;
    panel.refresh(false);
  });
});
Hooks.on("getActiveEffectConfigHeaderButtons", function(app, array) {
  array.unshift({class: MODULE, icon: ICON, onclick: _renderEditor.bind(app.document)});
});
