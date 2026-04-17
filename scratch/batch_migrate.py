"""
Batch migration runner for mcraesocial.
Applies all lessons learned:
  - Required Reading always sorted to bottom
  - Multicol sections always get stream-groups 2-col grid
  - PDF tiles use Google Drive auto-thumbnails
  - URL slugs match Weebly URL slugs directly
  - Banner image = same thumbnail as on the course landing page
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from migrate_units import migrate_unit

BASE_OUT = "c:/Users/Owner/Desktop/mcraesocial"
W = "https://mcraesocial.weebly.com"

UNITS = [
    # ── Social 9 ──────────────────────────────────────────────────────────
    {
        "url": f"{W}/federal-political-systems.html",
        "out": f"{BASE_OUT}/social-9/federal-political-systems",
        "course": "Social 9",
        "title": "Federal Political System",
        "img": "/assets/images/social-9/federal-political-systems.jpg",
    },
    {
        "url": f"{W}/ycja.html",
        "out": f"{BASE_OUT}/social-9/ycja",
        "course": "Social 9",
        "title": "Youth Criminal Justice Act",
        "img": "/assets/images/social-9/ycja.jpg",
    },
    {
        "url": f"{W}/the-ccrf.html",
        "out": f"{BASE_OUT}/social-9/ccrf",
        "course": "Social 9",
        "title": "Canadian Charter of Rights and Freedoms",
        "img": "/assets/images/social-9/ccrf.jpg",
    },
    {
        "url": f"{W}/collective-rights.html",
        "out": f"{BASE_OUT}/social-9/collective-rights",
        "course": "Social 9",
        "title": "Collective Rights",
        "img": "/assets/images/social-9/collective-rights.jpg",
    },
    {
        "url": f"{W}/immigration.html",
        "out": f"{BASE_OUT}/social-9/immigration",
        "course": "Social 9",
        "title": "Immigration",
        "img": "/assets/images/social-9/immigration.jpg",
    },
    {
        "url": f"{W}/mixed--market-econ.html",
        "out": f"{BASE_OUT}/social-9/economics",
        "course": "Social 9",
        "title": "Economic Systems",
        "img": "/assets/images/social-9/economics.jpg",
    },
    {
        "url": f"{W}/consumerism.html",
        "out": f"{BASE_OUT}/social-9/consumerism",
        "course": "Social 9",
        "title": "Consumerism",
        "img": "/assets/images/social-9/consumerism.jpg",
    },
    {
        "url": f"{W}/mock-election.html",
        "out": f"{BASE_OUT}/social-9/mock-election",
        "course": "Social 9",
        "title": "Mock Election",
        "img": None,
    },
    {
        "url": f"{W}/pat-prep.html",
        "out": f"{BASE_OUT}/social-9/pat-prep",
        "course": "Social 9",
        "title": "PAT Prep",
        "img": None,
    },

    # ── Social 10 ─────────────────────────────────────────────────────────
    {
        "url": f"{W}/historical.html",
        "out": f"{BASE_OUT}/social-10/historical",
        "course": "Social 10",
        "title": "Respond to Historical Globalization",
        "img": "/assets/images/social-10/respond-historical.jpg",
    },
    {
        "url": f"{W}/modern-globalization.html",
        "out": f"{BASE_OUT}/social-10/modern-globalization",
        "course": "Social 10",
        "title": "Sustainable Prosperity",
        "img": "/assets/images/social-10/sustainable-prosperity.jpg",
    },
    {
        "url": f"{W}/global-citizenship.html",
        "out": f"{BASE_OUT}/social-10/global-citizenship",
        "course": "Social 10",
        "title": "Global Citizenship",
        "img": "/assets/images/social-10/citizen.jpg",
    },

    # ── Social 20 ─────────────────────────────────────────────────────────
    {
        "url": f"{W}/create-a-country.html",
        "out": f"{BASE_OUT}/social-20/create-a-country",
        "course": "Social 20",
        "title": "Create a Country",
        "img": None,
    },
    {
        "url": f"{W}/model-un.html",
        "out": f"{BASE_OUT}/social-20/model-un",
        "course": "Social 20",
        "title": "Model United Nations",
        "img": None,
    },
    {
        "url": f"{W}/factors-of-nationalism.html",
        "out": f"{BASE_OUT}/social-20/factors-of-nationalism",
        "course": "Social 20",
        "title": "The Factors of Nationalism",
        "img": "/assets/images/social-20/factors-nationalism.jpg",
    },
    {
        "url": f"{W}/contending-loyalties.html",
        "out": f"{BASE_OUT}/social-20/contending-loyalties",
        "course": "Social 20",
        "title": "Contending Loyalties",
        "img": "/assets/images/social-20/contending-loyalties.jpg",
    },
    {
        "url": f"{W}/national-interest.html",
        "out": f"{BASE_OUT}/social-20/national-interest",
        "course": "Social 20",
        "title": "National Interest",
        "img": "/assets/images/social-20/national-interest.jpg",
    },
    {
        "url": f"{W}/ultranationalism.html",
        "out": f"{BASE_OUT}/social-20/ultranationalism",
        "course": "Social 20",
        "title": "Ultranationalism",
        "img": "/assets/images/social-20/ultranationalism.jpg",
    },
    {
        "url": f"{W}/internationalism.html",
        "out": f"{BASE_OUT}/social-20/internationalism",
        "course": "Social 20",
        "title": "Internationalism",
        "img": "/assets/images/social-20/internationalism.jpg",
    },
    {
        "url": f"{W}/challenges-to-canada.html",
        "out": f"{BASE_OUT}/social-20/challenges-to-canada",
        "course": "Social 20",
        "title": "Challenges to Canadian Nationalism",
        "img": "/assets/images/social-20/challenges.jpg",
    },

    # ── Social 30 ─────────────────────────────────────────────────────────
    {
        "url": f"{W}/intro-to-ideologies.html",
        "out": f"{BASE_OUT}/social-30/intro-to-ideologies",
        "course": "Social 30",
        "title": "Intro to Ideologies",
        "img": "/assets/images/social-30/intro.jpg",
    },
    {
        "url": f"{W}/economics.html",
        "out": f"{BASE_OUT}/social-30/economics",
        "course": "Social 30",
        "title": "Economics",
        "img": "/assets/images/social-30/economics.png",
    },
    {
        "url": f"{W}/dictatorships.html",
        "out": f"{BASE_OUT}/social-30/dictatorships",
        "course": "Social 30",
        "title": "Dictatorships",
        "img": "/assets/images/social-30/dictatorships.png",
    },
    {
        "url": f"{W}/democracy.html",
        "out": f"{BASE_OUT}/social-30/democracy",
        "course": "Social 30",
        "title": "Democracy",
        "img": "/assets/images/social-30/democracy.png",
    },
    {
        "url": f"{W}/imposing-liberalism.html",
        "out": f"{BASE_OUT}/social-30/imposition",
        "course": "Social 30",
        "title": "Imposing Liberalism",
        "img": "/assets/images/social-30/imposition.jpg",
    },
    {
        "url": f"{W}/illiberalism.html",
        "out": f"{BASE_OUT}/social-30/illiberalism",
        "course": "Social 30",
        "title": "Illiberalism",
        "img": "/assets/images/social-30/illiberalism.jpg",
    },
]


if __name__ == "__main__":
    total = len(UNITS)
    for i, u in enumerate(UNITS, 1):
        print(f"[{i}/{total}] {u['course']} — {u['url'].split('/')[-1]}")
        try:
            migrate_unit(
                url=u["url"],
                output_dir=u["out"],
                course_name=u["course"],
                custom_title=u.get("title"),
                image_path=u.get("img"),
            )
        except Exception as e:
            print(f"  ERROR: {e}")
    print("\nBatch complete.")
