/* STUB — replaced by the nutrition module build. */
(function () {
  const AMS = window.AMS, UI = window.UI, html = AMS.html;
  function Page() { AMS.useStore(); return html`<div className="page"><${UI.PageHead} title="Nutrition" sub="Module under construction" /><${UI.Empty} title="Nutrition" /></div>`; }
  AMS.registerModule({ id: "nutrition", label: "Nutrition", icon: "apple", group: "performance", order: 5, roles: ["director","coach","nutritionist","scientist","physio","doctor"], component: Page });
})();
