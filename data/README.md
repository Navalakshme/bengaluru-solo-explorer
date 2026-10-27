# Bengaluru place catalogue

`bengaluru-places.csv` is a research draft with 761 place-and-area candidates across eight discovery categories: 257 cafes and bakeries, 159 food and local eats, 171 gardens and outdoors, 52 adventure and games, 48 museums and learning, 44 markets and shopping, 18 heritage and landmarks, and 12 arts and performance. Some records refer to separate branches of the same chain; the same venue name in a different area is kept as a separate candidate. `Bengaluru_Places_Catalog.xlsx` is the same catalogue in a review-friendly workbook.

The list is a broad discovery draft, not an exhaustive or fully verified census. It was expanded from public Bengaluru/Karnataka tourism references, local directories, Bengaluru cafe guides, and BBMP parks/lakes lists. Added descriptions and taste cues are short editorial summaries; they do not claim first-hand verification of each branch, current atmosphere, or amenity. Every row remains a candidate: confirm that the venue is operating, identify the exact branch, and verify hours, access rules and current prices before showing it as a live recommendation. Group-size suggestions are planning guidance only; confirm actual seating or activity capacity with the venue.

Pricing is an indicative category-level band, not a verified menu or ticket price. Mood, ambience, and suggested group size are editorial discovery cues, not measured attributes or guarantees about crowd levels or capacity. The `Qloo entity ID` column remains blank; the live server sends candidate names to Qloo's Insights API, lets Qloo return and rank recognized matches against the user's taste/location signals, then joins those matches back to this catalogue by normalized venue name and area. Only Qloo-returned catalogue candidates can be shown; rows Qloo does not resolve are omitted. The catalogue is included with Vercel API functions and is never sent wholesale to the browser. Adding or editing a row changes the next deployment's candidate set.

Primary research references:

- Government of Karnataka, Bengaluru Urban tourism: <https://bengaluruurban.nic.in/en/tourism/>
- Karnataka Tourism, Bengaluru: <https://karnatakatourism.org/en/destinations/bengaluru/>
- Karnataka Tourism, Paper & Pie cafe: <https://karnatakatourism.org/en/experiences/paper-pie-cafe/>
- Bengaluru cafe directory (77 listings across 17 areas): <https://cafeblr.com/>
- Bengaluru specialty coffee and work-cafe guide: <https://indiago.app/en/bengaluru/cafes/>
- Bengaluru cafe listings: <https://bestofbengaluru.com/cafe/>
- Bengaluru cafes and coffee shops directory (reports 1,239 candidates in 85 areas): <https://askbengaluru.com/business-directory/cafes/>
- Bengaluru cafes: specialty coffee and work cafes: <https://indiago.app/en/bengaluru/cafes/>
- Bengaluru cafes selected by locals: <https://cafeblr.com/>
- BBMP park listings: <https://pms.bbmpgov.in/park>
- BBMP parks dataset: <https://data.opencity.in/dataset/bbmp-parks>
- Bengaluru Urban District adventure and activities: <https://bengaluruurban.nic.in/en/tourism/adventure-and-activities/>
- Bengaluru Urban District museums and tourism: <https://bengaluruurban.nic.in/en/tourism/>
- Karnataka Tourism, Bengaluru food and local culture: <https://karnatakatourism.org/en/destinations/bengaluru/>
- Karnataka Tourism, Bengaluru food guide: <https://kstdc.co/wp-content/uploads/2024/09/Bengaluru_Pocket_Hi_Res_compressed.pdf>
- District, PLaY Arena: <https://www.district.in/events/play-arena-bengaluru-2025-buy-tickets>

Do not treat this draft as an OpenStreetMap extract. A wide Overpass query was attempted during research but could not be rendered reliably in the browser. If OpenStreetMap-derived records are added later, retain attribution and comply with ODbL.
