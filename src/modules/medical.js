/* STUB — replaced by the medical module build. */
(function () {
  const AMS = window.AMS, UI = window.UI, html = AMS.html;
  function Page() { AMS.useStore(); return html`<div className="page"><${UI.PageHead} title="Medical & Injury" sub="Module under construction" /><${UI.Empty} title="Medical & Injury" /></div>`; }
  AMS.registerModule({ id: "medical", label: "Medical & Injury", icon: "medical", group: "health", order: 7, roles: ["director","coach","physio","doctor","scientist","nutritionist"], component: Page });
})();
