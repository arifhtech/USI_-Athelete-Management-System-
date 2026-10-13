/* STUB — replaced by the athlete-app module build. */
(function () {
  const AMS = window.AMS, UI = window.UI, html = AMS.html;
  function Page() { AMS.useStore(); return html`<div className="page"><${UI.PageHead} title="Athlete App" sub="Module under construction" /><${UI.Empty} title="Athlete App" /></div>`; }
  AMS.registerModule({ id: "athlete-app", label: "Athlete App", icon: "phone", group: "mobile", order: 10, roles: null, component: Page });
})();
