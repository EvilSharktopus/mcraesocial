// src/data/sources.js
// Single source of truth for all 6 Blood Minerals reading sources.
// Used by Phase 1 (source cards + checkboxes) and Phase 2 (notes per read source).

export const SOURCES = [
  {
    id: 1,
    title: "This Is What We Die For",
    outlet: "Amnesty International",
    tag: "NGO / advocacy",
    url: "https://www.amnesty.org/en/latest/news/2016/01/child-labour-behind-smart-phone-and-electric-car-batteries/",
  },
  {
    id: 2,
    title: "Special Report: Conflict Minerals in the DRC",
    outlet: "Genocide Watch",
    tag: "Current events / 2025",
    url: "https://www.genocidewatch.com/single-post/special-report-conflict-minerals-in-the-drc",
  },
  {
    id: 3,
    title: "In the east of the DRC, a war is financed by blood minerals",
    outlet: "Prospect Magazine",
    tag: "Journalism / lived experience",
    url: "https://www.prospectmagazine.co.uk/world/foreign-correspondence/64646/in-the-east-of-the-drc-a-war-is-financed-by-blood-minerals",
  },
  {
    id: 4,
    title: "Conflict Minerals in Tech Goods and Home Appliances",
    outlet: "Ethical Consumer",
    tag: "Consumer / policy",
    url: "https://www.ethicalconsumer.org/technology/conflict-minerals-tech-goods-home-appliances",
  },
  {
    id: 5,
    title: "The Rules to Stop the Trade in Blood Diamonds Are Too Weak",
    outlet: "New Lines Magazine",
    tag: "Policy critique",
    url: "https://newlinesmag.com/argument/the-rules-to-stop-the-trade-in-blood-diamonds-are-too-weak/",
  },
  {
    id: 6,
    title: "Critical Minerals, Critical Rights",
    outlet: "Business & Human Rights Centre",
    tag: "Reform / solutions",
    url: "https://www.business-humanrights.org/en/blog/critical-minerals-critical-rights-the-energy-transition-must-change-course-in-the-drc/",
  },
];

// Minimum sources a student must mark read before Phase 2 unlocks
export const MIN_READ_REQUIRED = 3;
