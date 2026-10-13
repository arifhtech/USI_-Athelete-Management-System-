/* STUB — replaced by the analytics module build. */
(function () {
  const AMS = window.AMS, UI = window.UI, html = AMS.html;
  function Page() { AMS.useStore(); return html`<div className="page"><${UI.PageHead} title="Analytics & BI" sub="Module under construction" /><${UI.Empty} title="Analytics & BI" /></div>`; }
  AMS.registerModule({ id: "analytics", label: "Analytics & BI", icon: "chart", group: "intelligence", order: 8, roles: ["director","coach","physio","doctor","scientist","nutritionist","ops"], component: Page });
})();
