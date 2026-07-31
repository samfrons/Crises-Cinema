#!/usr/bin/env python3
"""
Merges verified additions into public/MasterMovies.json from two legacy,
previously-uncommitted-to-the-pipeline sources already sitting in the repo:
  - public/movie.csv (24 rows, full schema, mostly dupes)
  - public/apocalyptic_movies_details_updated.csv (395 rows, title/year/rating/
    votes/director/country only -- no DisasterType or PlotSummary)

Both were scraped independently and never wired into build-data.mjs. This
script dedupes them against MasterMovies.json (by title+year, with year
re-parsed from the apocalyptic CSV's "Title (YYYY)" convention since its Year
column is unreliable -- it disagrees with the title's own year on ~15% of
rows), drops rows with corroborating evidence of a scraping error (impossible
director/year combinations, suspiciously duplicated vote counts), and adds
hand-verified DisasterType/PlotSummary for the rest so they classify
correctly under scripts/taxonomy.mjs.
"""
import csv, json, re, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def foldkey(title, year):
    """Accent/case-insensitive key so 'Café Flesh' matches 'cafe flesh'."""
    norm = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    return (norm.strip().lower(), year)

def load_master():
    with open(f"{ROOT}/public/MasterMovies.json") as f:
        return json.load(f)

def master_keys(master):
    keys = set()
    for m in master:
        t = str(m.get("Title", ""))
        try:
            y = int(m.get("Year"))
        except (TypeError, ValueError):
            continue
        keys.add(foldkey(t, y))
    return keys

# title (lowercased, year-suffix stripped) + year -> curated fields.
# Classifications are hand-assigned from genuine knowledge of each film's plot,
# not inferred by any script. Where a specific cause isn't one I'm confident
# of, DisasterType lands on the deliberately-vague post-apocalyptic language
# that scripts/taxonomy.mjs files under "After the Fall" -- consistent with
# what that bucket exists for, rather than guessing a specific cause.
CURATION = {
    ("the end of the world", 1916): dict(DisasterType="Comet Collision", MainCategory="Cosmic",
        PlotSummary="A scientist predicts a comet will collide with Earth; society unravels as the collision approaches."),
    ("things to come", 1936): dict(DisasterType="World War and Plague", MainCategory="Plague",
        PlotSummary="H.G. Wells's future history: a devastating decades-long world war is followed by a wandering plague, then a technocratic rebuild."),
    ("world without end", 1956): dict(DisasterType="Post-Nuclear War Mutants", MainCategory="Atomic",
        PlotSummary="Astronauts crash-land centuries in the future, on an Earth ravaged by nuclear war and inhabited by mutants."),
    ("battle of the worlds", 1961): dict(DisasterType="Rogue Planet", MainCategory="Cosmic",
        PlotSummary="A rogue planet enters the solar system on a collision course with Earth; an eccentric scientist works to stop it."),
    ("the time travelers", 1964): dict(DisasterType="Post-Nuclear War Wasteland", MainCategory="Atomic",
        PlotSummary="Scientists build a time portal into the year 2071 and find an Earth devastated by nuclear war and populated by mutants."),
    ("in the year 2889", 1967): dict(DisasterType="Post-Nuclear War Survivors", MainCategory="Atomic",
        PlotSummary="Survivors of a global nuclear war gather at a remote farmhouse, only to find the fallout has created mutant attackers."),
    ("beware! the blob", 1972): dict(DisasterType="Alien Organism", MainCategory="Invaders",
        PlotSummary="A frozen sample of the man-eating Blob is thawed and begins consuming an American town all over again."),
    ("a distant thunder", 1972): dict(DisasterType="Biblical Rapture", MainCategory="Divine",
        PlotSummary="Sequel to A Thief in the Night: those left behind after the Rapture face persecution under a totalitarian world government."),
    ("battle for the planet of the apes", 1973): dict(DisasterType="Ape Uprising", MainCategory="Invaders",
        PlotSummary="In an irradiated post-nuclear-war landscape, Caesar's ape colony and a community of mutated human survivors edge toward all-out war."),
    ("genesis ii", 1973): dict(DisasterType="Post-Apocalyptic Society", MainCategory="After the Fall",
        PlotSummary="A scientist wakes from suspended animation 150 years after a global catastrophe, into a fractured, tribalized world."),
    ("the final programme (the last days of man on earth)", 1973): dict(DisasterType="Societal Collapse", MainCategory="After the Fall",
        PlotSummary="A scientist races a rogue collective to build a computer capable of ending -- or resetting -- human civilization."),
    ("phase iv", 1974): dict(DisasterType="Insect Swarm", MainCategory="Invaders",
        PlotSummary="Desert ants develop a hive-level intelligence after a cosmic event and begin coordinating against the humans studying them."),
    ("planet earth", 1974): dict(DisasterType="Post-Apocalyptic Society", MainCategory="After the Fall",
        PlotSummary="An astronaut wakes centuries after a global collapse into a society where women rule and most men are enslaved."),
    ("black moon", 1975): dict(DisasterType="Societal Collapse", MainCategory="After the Fall",
        PlotSummary="A young woman flees a surreal war between men and women and takes refuge in a farmhouse where nothing behaves as it should."),
    ("the noah", 1975): dict(DisasterType="Biblical Flood Allegory", MainCategory="Divine",
        PlotSummary="A shipwrecked soldier, alone on a life raft, re-enacts the story of Noah as an allegory for surviving apocalyptic solitude."),
    ("the ultimate warrior", 1975): dict(DisasterType="Societal Collapse", MainCategory="After the Fall",
        PlotSummary="In a plague- and famine-ravaged future Manhattan, rival gangs fight over the last scraps of food and territory."),
    ("the late, great planet earth", 1976): dict(DisasterType="Biblical Prophecy", MainCategory="Divine",
        PlotSummary="A documentary, narrated by Orson Welles, arguing that current events fulfill biblical End Times prophecy."),
    ("the people who own the dark", 1976): dict(DisasterType="Nuclear War Blindness", MainCategory="Atomic",
        PlotSummary="Guests at a remote chateau survive a nuclear war only to discover the blast has left most of the outside world permanently blind."),
    ("end of the world", 1977): dict(DisasterType="Alien Invasion", MainCategory="Invaders",
        PlotSummary="Aliens disguised as Catholic priests infiltrate a small town while plotting to destroy Earth."),
    ("holocaust 2000", 1977): dict(DisasterType="Antichrist Prophecy", MainCategory="Divine",
        PlotSummary="An industrialist building a nuclear plant in the Middle East comes to suspect his own son is the Antichrist of biblical prophecy."),
    ("wizards", 1977): dict(DisasterType="Post-Nuclear Fantasy Wasteland", MainCategory="After the Fall",
        PlotSummary="Millennia after nuclear war mutates the survivors, a wizard and his tyrannical brother wage war using magic and salvaged technology."),
    ("ravagers", 1979): dict(DisasterType="Societal Collapse", MainCategory="After the Fall",
        PlotSummary="Survivors of a devastating war roam a lawless wasteland, hunted by marauders, in search of a rumored safe haven."),
    ("phoenix 2772", 1980): dict(DisasterType="Ecological Collapse", MainCategory="Climate",
        PlotSummary="With Earth dying of ecological collapse, a young pilot is sent on a cosmic quest for the life-giving Phoenix to save what's left of humanity."),
    ("image of the beast", 1981): dict(DisasterType="Biblical Rapture", MainCategory="Divine",
        PlotSummary="Third in the Thief in the Night series: believers face the Antichrist's world government and the mark of the beast after the Rapture."),
    ("mad max 2 (the road warrior)", 1981): dict(DisasterType="Global Oil Wars", MainCategory="Wreckage",
        PlotSummary="After the oil wars collapse civilization, a lone drifter helps a besieged desert settlement defend its fuel supply from a marauder gang."),
    ("malevil", 1981): dict(DisasterType="Nuclear War Survivors", MainCategory="Atomic",
        PlotSummary="A handful of villagers sheltering in a medieval French castle's wine cellar survive a nuclear war and must rebuild society from nothing."),
    ("battletruck", 1982): dict(DisasterType="Global Fuel Wars", MainCategory="Wreckage",
        PlotSummary="In a wasteland left by the Fuel Wars, an armored battle truck and its warlord terrorize a small community guarding its fuel reserves."),
    ("world war iii", 1982): dict(DisasterType="Nuclear Brinkmanship", MainCategory="Atomic",
        PlotSummary="Soviet commandos seize the Alaska pipeline, pushing the US and USSR to the edge of nuclear war."),
    ("cafe flesh", 1982): dict(DisasterType="Post-Nuclear War Society", MainCategory="Atomic",
        PlotSummary="After a nuclear war, most survivors are rendered unable to have sex without violent illness, and gather instead to watch the few who still can perform."),
    ("le dernier combat", 1983): dict(DisasterType="Societal Collapse", MainCategory="After the Fall",
        PlotSummary="In a wordless wasteland where humanity has lost the power of speech, a lone survivor searches for others amid roving scavengers."),
    ("the new barbarians", 1983): dict(DisasterType="Societal Collapse", MainCategory="After the Fall",
        PlotSummary="In a post-apocalyptic wasteland, a lone warrior defends a small band of survivors from a death cult of marauders."),
    ("stryker", 1983): dict(DisasterType="Water Scarcity", MainCategory="Climate",
        PlotSummary="In a desert wasteland where water has become the only currency worth killing for, rival factions battle to control the last wells."),
    ("the prodigal planet", 1983): dict(DisasterType="Biblical Rapture", MainCategory="Divine",
        PlotSummary="Fourth in the Thief in the Night series: the last believers face escalating persecution under the Antichrist's world government."),
    ("exterminators of the year 3000", 1983): dict(DisasterType="Water Scarcity", MainCategory="Climate",
        PlotSummary="In an irradiated wasteland where water is scarcer than fuel, a lone driver helps a settlement defend its water reserves from raiders."),
    ("das arche noah prinzip", 1984): dict(DisasterType="Weather Control Malfunction", MainCategory="Climate",
        PlotSummary="A weather-controlling space station, built to prevent climate disasters, malfunctions and threatens to trigger the catastrophes it was built to stop."),
    ("when the wind blows", 1984): dict(DisasterType="Nuclear War", MainCategory="Atomic",
        PlotSummary="An elderly English couple follow official civil-defence advice to survive a nuclear war, not understanding how little it will actually protect them."),
    ("sexmission", 1984): dict(DisasterType="Post-Nuclear War Society", MainCategory="Atomic",
        PlotSummary="Two men emerge from decades in cryogenic sleep into an underground, all-female society built after a nuclear war destroyed the surface."),
    ("nausicaa of the valley of the wind", 1984): dict(DisasterType="Ecological Collapse", MainCategory="Climate",
        PlotSummary="A millennium after industrial war poisoned the world, a princess tries to broker peace between rival kingdoms and a spreading toxic jungle."),
    ("night of the comet", 1984): dict(DisasterType="Comet Radiation", MainCategory="Cosmic",
        PlotSummary="A passing comet's radiation reduces most of Earth's population to dust or ravenous zombies, leaving a pair of Valley Girl sisters among the few survivors."),
    ("day of the dead", 1985): dict(DisasterType="Zombie Apocalypse", MainCategory="The Undead",
        PlotSummary="Holed up in an underground bunker, the last scientists and soldiers on Earth debate whether the zombie plague that wiped out civilization can still be reversed."),
    ("radioactive dreams", 1985): dict(DisasterType="Post-Nuclear War Wasteland", MainCategory="Atomic",
        PlotSummary="Two young men, raised in a fallout shelter on hard-boiled detective novels, emerge after a nuclear war into a wasteland playing out as film noir."),
    ("def-con 4", 1985): dict(DisasterType="Nuclear War Aftermath", MainCategory="Atomic",
        PlotSummary="Three astronauts return from orbit after a nuclear war to find the wasteland below ruled by a violent warlord."),
    ("wheels of fire", 1985): dict(DisasterType="Societal Collapse", MainCategory="After the Fall",
        PlotSummary="A drifter in a post-apocalyptic wasteland takes on a marauder gang to rescue his kidnapped sister."),
    ("america 3000", 1986): dict(DisasterType="Post-Nuclear War Society", MainCategory="Atomic",
        PlotSummary="A thousand years after nuclear war, surviving men are ruled by a matriarchal society that keeps them as laborers."),
    ("dead man's letters", 1986): dict(DisasterType="Nuclear War Aftermath", MainCategory="Atomic",
        PlotSummary="A physicist sheltering in a museum basement writes letters to his lost son after a nuclear war devastates his city."),
    ("fist of the north star", 1986): dict(DisasterType="Post-Nuclear War Wasteland", MainCategory="Atomic",
        PlotSummary="After nuclear war ends civilization, a martial artist wielding a deadly pressure-point technique wanders a wasteland ruled by gangs."),
    ("land of doom", 1986): dict(DisasterType="Post-Nuclear War Wasteland", MainCategory="Atomic",
        PlotSummary="A lone woman survivor of a nuclear war fends off a marauder gang while searching for other survivors."),
    ("solarbabies", 1986): dict(DisasterType="Water Scarcity", MainCategory="Climate",
        PlotSummary="In a desert wasteland controlled by a totalitarian regime that rations water, a group of orphans discovers a mysterious orb that can summon rain."),
    ("steel dawn", 1987): dict(DisasterType="Water Scarcity", MainCategory="Climate",
        PlotSummary="A wandering swordsman helps a desert settlement defend its well from a warlord trying to seize control of the region's water."),
    ("cherry 2000", 1987): dict(DisasterType="Societal Collapse", MainCategory="After the Fall",
        PlotSummary="In a near-future where society has stratified sharply and the wasteland beyond the cities is lawless, a man searches for a replacement part for his beloved android."),
    ("the seventh sign", 1988): dict(DisasterType="Biblical Prophecy", MainCategory="Divine",
        PlotSummary="A pregnant woman comes to believe a mysterious boarder is connected to a string of unnatural disasters heralding the biblical End Times."),
    ("miracle mile", 1988): dict(DisasterType="Nuclear War Warning", MainCategory="Atomic",
        PlotSummary="A man who answers a ringing pay phone learns nuclear missiles are already in the air, and has one night to find his new girlfriend before the bombs hit Los Angeles."),
    ("hell comes to frogtown", 1988): dict(DisasterType="Post-Nuclear War Mutants", MainCategory="Atomic",
        PlotSummary="In a wasteland left by nuclear war, one of the few remaining fertile men is conscripted to rescue captive women from a colony of mutant frog-people."),
    ("a visitor to a museum", 1989): dict(DisasterType="Ecological Collapse", MainCategory="Climate",
        PlotSummary="A visitor travels through a toxic, flooded wasteland to reach a museum, encountering a society of mutated outcasts along the way."),
    ("the blood of heroes (the salute of the jugger)", 1989): dict(DisasterType="Societal Collapse", MainCategory="After the Fall",
        PlotSummary="In a wasteland where nothing else remains, traveling teams compete in a brutal, ritualized blood sport for the scraps of a fallen civilization's glory."),
    ("bunker palace hotel", 1989): dict(DisasterType="Societal Collapse", MainCategory="After the Fall",
        PlotSummary="As revolution closes in outside, a dictator's cronies hole up in a bunker hotel awaiting a coup they can no longer stop."),
    ("cyborg", 1989): dict(DisasterType="Plague Collapse", MainCategory="Plague",
        PlotSummary="A plague has devastated civilization, and a drifter escorts a cyborg carrying the cure's data across a wasteland stalked by a marauder gang."),
    ("aftershock", 1990): dict(DisasterType="Societal Collapse", MainCategory="After the Fall",
        PlotSummary="A drifter defends a wasteland settlement from a gang of marauders in the ruins of a collapsed civilization."),
    ("by dawn's early light", 1990): dict(DisasterType="Accidental Nuclear War", MainCategory="Atomic",
        PlotSummary="A stolen nuclear missile triggers an accidental strike, and US and Soviet commanders race to stop an escalating nuclear war neither side intended to start."),
    ("solar crisis", 1990): dict(DisasterType="Solar Flare", MainCategory="Cosmic",
        PlotSummary="A superflare threatens to incinerate Earth, and a crew races to detonate a probe inside the sun before it strikes."),
    ("the handmaid's tale", 1990): dict(DisasterType="Fertility Collapse", MainCategory="After the Fall",
        PlotSummary="After a fertility crisis and a coup, a fundamentalist theocracy forces fertile women into reproductive servitude for the ruling class."),
    ("hardware", 1990): dict(DisasterType="Rogue Combat Robot", MainCategory="Machines",
        PlotSummary="In an irradiated, overpopulated future, a salvaged military robot reassembles itself in an artist's apartment and turns lethal."),
    ("circuitry man", 1990): dict(DisasterType="Societal Collapse", MainCategory="Machines",
        PlotSummary="In a post-collapse Los Angeles abandoned to the surface world, a bodyguard and an android flee underground criminals through the ruins."),
    ("split second", 1992): dict(DisasterType="Flooding", MainCategory="Climate",
        PlotSummary="In a London half-submerged by rising sea levels, a detective hunts a creature killing people in the flooded tunnels below the city."),
    ("blue gender:the warrior", 2002): dict(DisasterType="Insect Invasion", MainCategory="Invaders",
        PlotSummary="A man wakes from decades of cryogenic sleep to find humanity driven off the surface of the Earth by giant mutated insects."),
    ("tooth and nail", 2007): dict(DisasterType="Resource Collapse", MainCategory="After the Fall",
        PlotSummary="After the world's oil runs out and civilization collapses, a small band of survivors sheltering in an abandoned hospital is stalked by cannibalistic marauders."),
    ("20 years after", 2007): dict(DisasterType="Plague Aftermath", MainCategory="The Undead",
        PlotSummary="Two decades after a plague turned most of the population, a small band of survivors documents what's left of the world on camera."),
    ("daybreakers", 2008): dict(DisasterType="Vampire Pandemic", MainCategory="The Undead",
        PlotSummary="A decade into a pandemic that has turned most of humanity into vampires, a hematologist races to find a blood substitute before the dwindling human population runs out."),
    ("juan of the dead", 2010): dict(DisasterType="Zombie Apocalypse", MainCategory="The Undead",
        PlotSummary="As Havana succumbs to a sudden zombie outbreak the government insists are just dissidents, a slacker and his friends go into the zombie-killing-for-hire business."),
    ("the host", 2013): dict(DisasterType="Alien Body Snatchers", MainCategory="Invaders",
        PlotSummary="Parasitic aliens have quietly taken over nearly every human mind on Earth, except for the resistant few whose consciousness survives alongside their invader."),
    ("the signal", 2007): dict(DisasterType="Rogue Technological Signal", MainCategory="Machines",
        PlotSummary="A mysterious transmission through phones, TVs, and radios drives everyone who receives it into violent psychosis."),
    ("the end of the world and the cat's disappearance", 2015): dict(DisasterType="Apocalyptic Premonition", MainCategory="After the Fall",
        PlotSummary="A man haunted by dreams of the apocalypse searches for his missing cat as signs mount that the end really is approaching."),
    ("the walking deceased", 2015): dict(DisasterType="Zombie Apocalypse Parody", MainCategory="The Undead",
        PlotSummary="A parody of zombie-apocalypse films following a hapless group of survivors through every genre cliché of the outbreak."),
    ("attack on titan", 2015): dict(DisasterType="Giant Humanoid Invasion", MainCategory="Invaders",
        PlotSummary="Humanity's last remnants shelter behind massive walls to survive the Titans, giant humanoid creatures that have devoured almost everyone else.",
        Rating=None, NumberOfRatings=None),  # source rating (9.1) doesn't match the live-action film; dropped rather than propagated
    ("bird box", 2018): dict(DisasterType="Sight-Based Entity", MainCategory="Invaders",
        PlotSummary="An unseen presence drives anyone who looks at it to suicidal violence, forcing survivors to navigate a ruined world blindfolded."),
    ("blue world order", 2018): dict(DisasterType="Water Scarcity", MainCategory="Climate",
        PlotSummary="In a wasteland stripped of clean water, a lone woman crosses hostile territory controlled by rival water cartels."),
    ("a quiet place part ii", 2021): dict(DisasterType="Alien Invasion", MainCategory="Invaders",
        PlotSummary="As the Abbott family ventures beyond their farm following a blind, sound-hunting alien invasion, they find other survivors -- and other threats."),
}

# Rows dropped outright: internal evidence of a scraping error makes them
# unreliable rather than merely uncertain.
EXCLUDE = {
    ("on the beach", 2000),   # vote count (14621) is an exact duplicate of the 1959 Kramer film already in the set -- looks like a mis-scrape, not a real 2000 entry
    ("the last warrior", 2000),  # credited director (Dyachenko) made a film by this name in 2017, not 2000; year/identity unreliable
    ("the dark hour", 2007),  # credited director Charles Lamont died in 1993 and worked only 1920s-1950s; cannot have directed a 2007 film
    ("edge of tomorrow", 2013),  # already in MasterMovies.json under its correct year, 2014; this row is that same film with a wrong year, not a distinct entry
}

def parse_title_year(raw_title):
    m = re.search(r"\((\d{4})\)\s*$", raw_title.strip())
    if not m:
        return raw_title.strip(), None
    year = int(m.group(1))
    clean = re.sub(r"\s*\(\d{4}\)\s*$", "", raw_title.strip())
    return clean, year

def to_int_or_none(v):
    try:
        return int(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None

def to_float_or_none(v):
    try:
        f = float(v)
        return f if 0 < f <= 10 else None
    except (TypeError, ValueError):
        return None

def main():
    master = load_master()
    keys = master_keys(master)

    added = []

    # --- Source 1: public/movie.csv (full schema already) ---
    with open(f"{ROOT}/public/movie.csv") as f:
        for row in csv.DictReader(f):
            title, year = row["title"].strip(), int(row["year"])
            key = foldkey(title, year)
            if key in keys or key in EXCLUDE:
                continue
            keys.add(key)
            added.append({
                "ThumbnailUrl": None,
                "LinkUrl": None,
                "Title": title,
                "Year": year,
                "PlotSummary": row["plotSummary"].strip(),
                "DisasterType": row["disasterType"].strip(),
                "MainCategory": row["disasterType"].strip(),
                "Subcategory": None,
                "SpecificDisasterTypes": [],
                "Rating": to_float_or_none(row["rating"]),
                "NumberOfRatings": to_int_or_none(row["numberOfRatings"]),
                "Country": row["country"].strip() or None,
                "Langauge": None,
                "Director": row["director"].strip() or None,
                "_source": "legacy-movie-csv",
            })

    # --- Source 2: public/apocalyptic_movies_details_updated.csv (needs curation) ---
    with open(f"{ROOT}/public/apocalyptic_movies_details_updated.csv") as f:
        for row in csv.DictReader(f):
            title, year = parse_title_year(row["Title"])
            if year is None:
                continue
            key = foldkey(title, year)
            if key in keys or key in EXCLUDE:
                continue
            curated = CURATION.get(key)
            if curated is None:
                # No hand-verified classification available for this one --
                # skip rather than guess. (Should be zero if CURATION is complete.)
                print(f"SKIP (uncurated): {year} {title}")
                continue
            keys.add(key)
            rating = curated["Rating"] if "Rating" in curated else to_float_or_none(row.get("Rating"))
            votes = curated["NumberOfRatings"] if "NumberOfRatings" in curated else to_int_or_none(row.get("Number of Ratings"))
            director = row.get("Director", "").strip()
            country = row.get("Country", "").strip()
            added.append({
                "ThumbnailUrl": None,
                "LinkUrl": None,
                "Title": title,
                "Year": year,
                "PlotSummary": curated["PlotSummary"],
                "DisasterType": curated["DisasterType"],
                "MainCategory": curated["MainCategory"],
                "Subcategory": None,
                "SpecificDisasterTypes": [],
                "Rating": rating,
                "NumberOfRatings": votes,
                "Country": country if country and country.lower() not in ("unknown", "n/a") else None,
                "Langauge": None,
                "Director": director if director and director.lower() not in ("unknown", "n/a") else None,
                "_source": "legacy-apocalyptic-csv",
            })

    print(f"\nTotal added: {len(added)}")
    for a in added:
        del a["_source"]

    master.extend(added)
    with open(f"{ROOT}/public/MasterMovies.json", "w") as f:
        json.dump(master, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"MasterMovies.json now has {len(master)} entries")

if __name__ == "__main__":
    main()
