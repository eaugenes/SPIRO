/* =====================================================================
   HealthGuideView: public TB Health Guide (symptoms, prevention, where to
   get checked), shown on the introduction page. General information only;
   no facilities are listed by name.
   ===================================================================== */

import { $$, icon } from "../utils/dom.js";
import { esc } from "../utils/format.js";
import { PREVENTION } from "./place-details-view.js";

export const HealthGuideView = {
  title: "Learn About Tuberculosis",
  html() {
    return `<div class="guide">
      <p class="lead g-lead">General information for residents and visitors of Metro Manila. For advice about your own health, talk to a health worker.</p>
      <nav class="g-nav" aria-label="Guide sections">
        <a class="g-btn" href="#g-sym" data-jump="g-sym">${icon("p-cough", 26)}<span><b>Symptoms</b><small>Signs to watch for</small></span></a>
        <a class="g-btn" href="#g-prev" data-jump="g-prev">${icon("p-mask", 26)}<span><b>How to prevent TB</b><small>Everyday steps</small></span></a>
        <a class="g-btn" href="#g-care" data-jump="g-care">${icon("i-hosp", 26)}<span><b>Where to get checked</b><small>Free testing and treatment</small></span></a>
        <a class="g-btn" href="#g-more" data-jump="g-more">${icon("i-ext", 26)}<span><b>More information</b><small>Trusted sources</small></span></a>
      </nav>
      <div class="g-grid">

      <section class="g-sec" aria-labelledby="g-what-h">
        <h3 id="g-what-h">What TB is</h3>
        <p>Tuberculosis (TB) is an infectious disease caused by bacteria. It most often affects the lungs. TB spreads through the air when a person with active lung TB coughs, speaks or sings, and people nearby breathe in the bacteria. Spending long periods close together in enclosed, poorly ventilated spaces raises the chance of exposure. TB is preventable and curable with a full course of treatment.</p>
      </section>

      <section class="g-sec" id="g-sym" aria-labelledby="g-sym-h" tabindex="-1">
        <h3 id="g-sym-h">Symptoms</h3>
        <ul class="g-list">
          <li>Cough lasting two weeks or more</li>
          <li>Coughing up phlegm or blood</li>
          <li>Fever, often in the afternoon or evening</li>
          <li>Night sweats</li>
          <li>Weight loss without trying</li>
          <li>Chest pain, tiredness or loss of appetite</li>
        </ul>
        <p class="small muted">Some people with TB have mild symptoms or none at all, which is why people who live with someone who has TB should also get checked.</p>
      </section>

      <section class="g-sec" id="g-prev" aria-labelledby="g-prev-h" tabindex="-1">
        <h3 id="g-prev-h">How to prevent TB</h3>
        <ul class="g-prev">
          ${PREVENTION.map(p => `<li><span class="prev-ic">${icon(p.icon)}</span><div><b>${p.label}</b><p>${esc(p.text)}</p></div></li>`).join("")}
          <li><span class="prev-ic">${icon("i-hosp")}</span><div><b>Finish treatment</b><p>People on TB treatment should take every dose until the course is complete. Stopping early can make TB harder to treat.</p></div></li>
          <li><span class="prev-ic">${icon("i-check")}</span><div><b>BCG vaccination for babies</b><p>Infants receive the BCG vaccine under the national immunization schedule. Ask your health center about it.</p></div></li>
        </ul>
      </section>

      <section class="g-sec" id="g-care" aria-labelledby="g-care-h" tabindex="-1">
        <h3 id="g-care-h">Where to get checked</h3>
        <p>If you have a cough for two weeks or more, or other symptoms above, visit your <b>barangay health station</b>, your <b>city or municipal health office</b>, or a <b>TB DOTS facility</b>. TB testing and treatment are free in public health facilities in the Philippines. Your barangay health station can tell you where the nearest TB DOTS facility is.</p>
        <p class="notice warn">${icon("i-info")}<span>If you have trouble breathing, cough up a lot of blood or feel very ill, get emergency care right away. The national emergency hotline is <b>911</b>.</span></p>
        <p class="small">Visitors to Metro Manila who feel unwell can go to any public health center or hospital.</p>
        <p><a class="btn primary" href="#map" data-layer="fac">${icon("i-pin")}Find a TB screening facility</a></p>
      </section>

      <section class="g-sec" aria-labelledby="g-com-h">
        <h3 id="g-com-h">For commuters and visitors</h3>
        <p>Crowded trains, terminals and markets are part of daily life in Metro Manila. Travelling at less busy hours, keeping vehicle windows open where possible and wearing a mask when you are coughing are practical habits. The crowding layer on the map shows BestTime forecasts of when malls are usually busy; it covers malls only, it is not live and it does not label any place as safe or unsafe.</p>
        <p class="remind">Reminder: A busy place is not evidence that TB is spreading there.</p>
      </section>

      <section class="g-sec" id="g-more" aria-labelledby="g-more-h" tabindex="-1">
        <h3 id="g-more-h">More information</h3>
        <ul class="res-list">
          <li><a href="https://doh.gov.ph/" target="_blank" rel="noopener">${icon("i-ext")}Department of Health (Philippines)</a></li>
          <li><a href="https://www.who.int/news-room/fact-sheets/detail/tuberculosis" target="_blank" rel="noopener">${icon("i-ext")}World Health Organization: tuberculosis fact sheet</a></li>
          <li><a href="https://www.cdc.gov/tb/" target="_blank" rel="noopener">${icon("i-ext")}US CDC: tuberculosis basics</a></li>
        </ul>
        <p class="xs muted">This website is not a diagnostic tool. It cannot tell whether a person has TB or whether a place is safe.</p>
      </section>
      </div>
    </div>`;
  },
  bind(root) {
    $$("[data-jump]", root).forEach(a => a.addEventListener("click", e => {
      e.preventDefault(); const t = document.getElementById(a.dataset.jump);
      if (t) { t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); t.focus({ preventScroll: true });
        $$(".g-btn", root).forEach(b => b.classList.toggle("on", b === a)); t.classList.remove("g-flash"); void t.offsetWidth; t.classList.add("g-flash"); }
    }));
  }
};
