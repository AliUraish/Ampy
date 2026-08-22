// data/craigslistLocations.js
//
// Full list of Craigslist site locations (region / state-or-country / area
// slug / display name), used to constrain the `location` query param on
// search instead of free text. A mistyped or non-existent location
// (e.g. "San Franscico") 404s against Craigslist's search endpoint and
// silently falls back to mock data — this list is the fix: every value
// the API accepts is a slug Craigslist actually recognizes.
//
// Source: https://www.craigslist.org/about/sites (Craigslist's own site
// index). Regenerate by re-running the scrape in this file's git history /
// the project notes if Craigslist adds or renames sites — this is a static
// snapshot, not fetched live, so it won't silently go stale in a way that
// breaks the app (an outdated slug just 404s like today, it doesn't crash).

const craigslistLocations = [
  {
    "region": "US",
    "state": "Alabama",
    "slug": "auburn",
    "name": "auburn"
  },
  {
    "region": "US",
    "state": "Alabama",
    "slug": "bham",
    "name": "birmingham"
  },
  {
    "region": "US",
    "state": "Alabama",
    "slug": "dothan",
    "name": "dothan"
  },
  {
    "region": "US",
    "state": "Alabama",
    "slug": "shoals",
    "name": "florence / muscle shoals"
  },
  {
    "region": "US",
    "state": "Alabama",
    "slug": "gadsden",
    "name": "gadsden-anniston"
  },
  {
    "region": "US",
    "state": "Alabama",
    "slug": "huntsville",
    "name": "huntsville / decatur"
  },
  {
    "region": "US",
    "state": "Alabama",
    "slug": "mobile",
    "name": "mobile"
  },
  {
    "region": "US",
    "state": "Alabama",
    "slug": "montgomery",
    "name": "montgomery"
  },
  {
    "region": "US",
    "state": "Alabama",
    "slug": "tuscaloosa",
    "name": "tuscaloosa"
  },
  {
    "region": "US",
    "state": "Alaska",
    "slug": "anchorage",
    "name": "anchorage / mat-su"
  },
  {
    "region": "US",
    "state": "Alaska",
    "slug": "fairbanks",
    "name": "fairbanks"
  },
  {
    "region": "US",
    "state": "Alaska",
    "slug": "kenai",
    "name": "kenai peninsula"
  },
  {
    "region": "US",
    "state": "Alaska",
    "slug": "juneau",
    "name": "southeast alaska"
  },
  {
    "region": "US",
    "state": "Arizona",
    "slug": "flagstaff",
    "name": "flagstaff / sedona"
  },
  {
    "region": "US",
    "state": "Arizona",
    "slug": "mohave",
    "name": "mohave county"
  },
  {
    "region": "US",
    "state": "Arizona",
    "slug": "phoenix",
    "name": "phoenix"
  },
  {
    "region": "US",
    "state": "Arizona",
    "slug": "prescott",
    "name": "prescott"
  },
  {
    "region": "US",
    "state": "Arizona",
    "slug": "showlow",
    "name": "show low"
  },
  {
    "region": "US",
    "state": "Arizona",
    "slug": "sierravista",
    "name": "sierra vista"
  },
  {
    "region": "US",
    "state": "Arizona",
    "slug": "tucson",
    "name": "tucson"
  },
  {
    "region": "US",
    "state": "Arizona",
    "slug": "yuma",
    "name": "yuma"
  },
  {
    "region": "US",
    "state": "Arkansas",
    "slug": "fayar",
    "name": "fayetteville"
  },
  {
    "region": "US",
    "state": "Arkansas",
    "slug": "fortsmith",
    "name": "fort smith"
  },
  {
    "region": "US",
    "state": "Arkansas",
    "slug": "jonesboro",
    "name": "jonesboro"
  },
  {
    "region": "US",
    "state": "Arkansas",
    "slug": "littlerock",
    "name": "little rock"
  },
  {
    "region": "US",
    "state": "Arkansas",
    "slug": "texarkana",
    "name": "texarkana"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "bakersfield",
    "name": "bakersfield"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "chico",
    "name": "chico"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "fresno",
    "name": "fresno / madera"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "goldcountry",
    "name": "gold country"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "hanford",
    "name": "hanford-corcoran"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "humboldt",
    "name": "humboldt county"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "imperial",
    "name": "imperial county"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "inlandempire",
    "name": "inland empire"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "losangeles",
    "name": "los angeles"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "mendocino",
    "name": "mendocino county"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "merced",
    "name": "merced"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "modesto",
    "name": "modesto"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "monterey",
    "name": "monterey bay"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "orangecounty",
    "name": "orange county"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "palmsprings",
    "name": "palm springs"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "redding",
    "name": "redding"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "sacramento",
    "name": "sacramento"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "sandiego",
    "name": "san diego"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "sfbay",
    "name": "san francisco bay area"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "slo",
    "name": "san luis obispo"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "santabarbara",
    "name": "santa barbara"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "santamaria",
    "name": "santa maria"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "siskiyou",
    "name": "siskiyou county"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "stockton",
    "name": "stockton"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "susanville",
    "name": "susanville"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "ventura",
    "name": "ventura county"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "visalia",
    "name": "visalia-tulare"
  },
  {
    "region": "US",
    "state": "California",
    "slug": "yubasutter",
    "name": "yuba-sutter"
  },
  {
    "region": "US",
    "state": "Colorado",
    "slug": "boulder",
    "name": "boulder"
  },
  {
    "region": "US",
    "state": "Colorado",
    "slug": "cosprings",
    "name": "colorado springs"
  },
  {
    "region": "US",
    "state": "Colorado",
    "slug": "denver",
    "name": "denver"
  },
  {
    "region": "US",
    "state": "Colorado",
    "slug": "eastco",
    "name": "eastern CO"
  },
  {
    "region": "US",
    "state": "Colorado",
    "slug": "fortcollins",
    "name": "fort collins / north CO"
  },
  {
    "region": "US",
    "state": "Colorado",
    "slug": "rockies",
    "name": "high rockies"
  },
  {
    "region": "US",
    "state": "Colorado",
    "slug": "pueblo",
    "name": "pueblo"
  },
  {
    "region": "US",
    "state": "Colorado",
    "slug": "westslope",
    "name": "western slope"
  },
  {
    "region": "US",
    "state": "Connecticut",
    "slug": "newlondon",
    "name": "eastern CT"
  },
  {
    "region": "US",
    "state": "Connecticut",
    "slug": "hartford",
    "name": "hartford"
  },
  {
    "region": "US",
    "state": "Connecticut",
    "slug": "newhaven",
    "name": "new haven"
  },
  {
    "region": "US",
    "state": "Connecticut",
    "slug": "nwct",
    "name": "northwest CT"
  },
  {
    "region": "US",
    "state": "Delaware",
    "slug": "delaware",
    "name": "delaware"
  },
  {
    "region": "US",
    "state": "District of Columbia",
    "slug": "washingtondc",
    "name": "washington"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "miami",
    "name": "broward county"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "daytona",
    "name": "daytona beach"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "keys",
    "name": "florida keys"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "fortmyers",
    "name": "ft myers / SW florida"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "gainesville",
    "name": "gainesville"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "cfl",
    "name": "heartland florida"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "jacksonville",
    "name": "jacksonville"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "lakeland",
    "name": "lakeland"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "lakecity",
    "name": "north central FL"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "ocala",
    "name": "ocala"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "okaloosa",
    "name": "okaloosa / walton"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "orlando",
    "name": "orlando"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "panamacity",
    "name": "panama city"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "pensacola",
    "name": "pensacola"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "sarasota",
    "name": "sarasota-bradenton"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "spacecoast",
    "name": "space coast"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "staugustine",
    "name": "st augustine"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "tallahassee",
    "name": "tallahassee"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "tampa",
    "name": "tampa bay area"
  },
  {
    "region": "US",
    "state": "Florida",
    "slug": "treasure",
    "name": "treasure coast"
  },
  {
    "region": "US",
    "state": "Georgia",
    "slug": "albanyga",
    "name": "albany"
  },
  {
    "region": "US",
    "state": "Georgia",
    "slug": "athensga",
    "name": "athens"
  },
  {
    "region": "US",
    "state": "Georgia",
    "slug": "atlanta",
    "name": "atlanta"
  },
  {
    "region": "US",
    "state": "Georgia",
    "slug": "augusta",
    "name": "augusta"
  },
  {
    "region": "US",
    "state": "Georgia",
    "slug": "brunswick",
    "name": "brunswick"
  },
  {
    "region": "US",
    "state": "Georgia",
    "slug": "columbusga",
    "name": "columbus"
  },
  {
    "region": "US",
    "state": "Georgia",
    "slug": "macon",
    "name": "macon / warner robins"
  },
  {
    "region": "US",
    "state": "Georgia",
    "slug": "nwga",
    "name": "northwest GA"
  },
  {
    "region": "US",
    "state": "Georgia",
    "slug": "savannah",
    "name": "savannah / hinesville"
  },
  {
    "region": "US",
    "state": "Georgia",
    "slug": "statesboro",
    "name": "statesboro"
  },
  {
    "region": "US",
    "state": "Georgia",
    "slug": "valdosta",
    "name": "valdosta"
  },
  {
    "region": "US",
    "state": "Hawaii",
    "slug": "honolulu",
    "name": "hawaii"
  },
  {
    "region": "US",
    "state": "Idaho",
    "slug": "boise",
    "name": "boise"
  },
  {
    "region": "US",
    "state": "Idaho",
    "slug": "eastidaho",
    "name": "east idaho"
  },
  {
    "region": "US",
    "state": "Idaho",
    "slug": "lewiston",
    "name": "lewiston / clarkston"
  },
  {
    "region": "US",
    "state": "Idaho",
    "slug": "twinfalls",
    "name": "twin falls"
  },
  {
    "region": "US",
    "state": "Illinois",
    "slug": "bn",
    "name": "bloomington-normal"
  },
  {
    "region": "US",
    "state": "Illinois",
    "slug": "chambana",
    "name": "champaign urbana"
  },
  {
    "region": "US",
    "state": "Illinois",
    "slug": "chicago",
    "name": "chicago"
  },
  {
    "region": "US",
    "state": "Illinois",
    "slug": "decatur",
    "name": "decatur"
  },
  {
    "region": "US",
    "state": "Illinois",
    "slug": "lasalle",
    "name": "la salle co"
  },
  {
    "region": "US",
    "state": "Illinois",
    "slug": "mattoon",
    "name": "mattoon-charleston"
  },
  {
    "region": "US",
    "state": "Illinois",
    "slug": "peoria",
    "name": "peoria"
  },
  {
    "region": "US",
    "state": "Illinois",
    "slug": "rockford",
    "name": "rockford"
  },
  {
    "region": "US",
    "state": "Illinois",
    "slug": "carbondale",
    "name": "southern illinois"
  },
  {
    "region": "US",
    "state": "Illinois",
    "slug": "springfieldil",
    "name": "springfield"
  },
  {
    "region": "US",
    "state": "Illinois",
    "slug": "quincy",
    "name": "western IL"
  },
  {
    "region": "US",
    "state": "Indiana",
    "slug": "bloomington",
    "name": "bloomington"
  },
  {
    "region": "US",
    "state": "Indiana",
    "slug": "evansville",
    "name": "evansville"
  },
  {
    "region": "US",
    "state": "Indiana",
    "slug": "fortwayne",
    "name": "fort wayne"
  },
  {
    "region": "US",
    "state": "Indiana",
    "slug": "indianapolis",
    "name": "indianapolis"
  },
  {
    "region": "US",
    "state": "Indiana",
    "slug": "kokomo",
    "name": "kokomo"
  },
  {
    "region": "US",
    "state": "Indiana",
    "slug": "tippecanoe",
    "name": "lafayette / west lafayette"
  },
  {
    "region": "US",
    "state": "Indiana",
    "slug": "muncie",
    "name": "muncie / anderson"
  },
  {
    "region": "US",
    "state": "Indiana",
    "slug": "richmondin",
    "name": "richmond"
  },
  {
    "region": "US",
    "state": "Indiana",
    "slug": "southbend",
    "name": "south bend / michiana"
  },
  {
    "region": "US",
    "state": "Indiana",
    "slug": "terrehaute",
    "name": "terre haute"
  },
  {
    "region": "US",
    "state": "Iowa",
    "slug": "ames",
    "name": "ames"
  },
  {
    "region": "US",
    "state": "Iowa",
    "slug": "cedarrapids",
    "name": "cedar rapids"
  },
  {
    "region": "US",
    "state": "Iowa",
    "slug": "desmoines",
    "name": "des moines"
  },
  {
    "region": "US",
    "state": "Iowa",
    "slug": "dubuque",
    "name": "dubuque"
  },
  {
    "region": "US",
    "state": "Iowa",
    "slug": "fortdodge",
    "name": "fort dodge"
  },
  {
    "region": "US",
    "state": "Iowa",
    "slug": "iowacity",
    "name": "iowa city"
  },
  {
    "region": "US",
    "state": "Iowa",
    "slug": "masoncity",
    "name": "mason city"
  },
  {
    "region": "US",
    "state": "Iowa",
    "slug": "quadcities",
    "name": "quad cities"
  },
  {
    "region": "US",
    "state": "Iowa",
    "slug": "siouxcity",
    "name": "sioux city"
  },
  {
    "region": "US",
    "state": "Iowa",
    "slug": "ottumwa",
    "name": "southeast IA"
  },
  {
    "region": "US",
    "state": "Iowa",
    "slug": "waterloo",
    "name": "waterloo / cedar falls"
  },
  {
    "region": "US",
    "state": "Kansas",
    "slug": "lawrence",
    "name": "lawrence"
  },
  {
    "region": "US",
    "state": "Kansas",
    "slug": "ksu",
    "name": "manhattan"
  },
  {
    "region": "US",
    "state": "Kansas",
    "slug": "nwks",
    "name": "northwest KS"
  },
  {
    "region": "US",
    "state": "Kansas",
    "slug": "salina",
    "name": "salina"
  },
  {
    "region": "US",
    "state": "Kansas",
    "slug": "seks",
    "name": "southeast KS"
  },
  {
    "region": "US",
    "state": "Kansas",
    "slug": "swks",
    "name": "southwest KS"
  },
  {
    "region": "US",
    "state": "Kansas",
    "slug": "topeka",
    "name": "topeka"
  },
  {
    "region": "US",
    "state": "Kansas",
    "slug": "wichita",
    "name": "wichita"
  },
  {
    "region": "US",
    "state": "Kentucky",
    "slug": "bgky",
    "name": "bowling green"
  },
  {
    "region": "US",
    "state": "Kentucky",
    "slug": "eastky",
    "name": "eastern kentucky"
  },
  {
    "region": "US",
    "state": "Kentucky",
    "slug": "lexington",
    "name": "lexington"
  },
  {
    "region": "US",
    "state": "Kentucky",
    "slug": "louisville",
    "name": "louisville"
  },
  {
    "region": "US",
    "state": "Kentucky",
    "slug": "owensboro",
    "name": "owensboro"
  },
  {
    "region": "US",
    "state": "Kentucky",
    "slug": "westky",
    "name": "western KY"
  },
  {
    "region": "US",
    "state": "Louisiana",
    "slug": "batonrouge",
    "name": "baton rouge"
  },
  {
    "region": "US",
    "state": "Louisiana",
    "slug": "cenla",
    "name": "central louisiana"
  },
  {
    "region": "US",
    "state": "Louisiana",
    "slug": "houma",
    "name": "houma"
  },
  {
    "region": "US",
    "state": "Louisiana",
    "slug": "lafayette",
    "name": "lafayette"
  },
  {
    "region": "US",
    "state": "Louisiana",
    "slug": "lakecharles",
    "name": "lake charles"
  },
  {
    "region": "US",
    "state": "Louisiana",
    "slug": "monroe",
    "name": "monroe"
  },
  {
    "region": "US",
    "state": "Louisiana",
    "slug": "neworleans",
    "name": "new orleans"
  },
  {
    "region": "US",
    "state": "Louisiana",
    "slug": "shreveport",
    "name": "shreveport"
  },
  {
    "region": "US",
    "state": "Maine",
    "slug": "maine",
    "name": "maine"
  },
  {
    "region": "US",
    "state": "Maryland",
    "slug": "annapolis",
    "name": "annapolis"
  },
  {
    "region": "US",
    "state": "Maryland",
    "slug": "baltimore",
    "name": "baltimore"
  },
  {
    "region": "US",
    "state": "Maryland",
    "slug": "easternshore",
    "name": "eastern shore"
  },
  {
    "region": "US",
    "state": "Maryland",
    "slug": "frederick",
    "name": "frederick"
  },
  {
    "region": "US",
    "state": "Maryland",
    "slug": "smd",
    "name": "southern maryland"
  },
  {
    "region": "US",
    "state": "Maryland",
    "slug": "westmd",
    "name": "western maryland"
  },
  {
    "region": "US",
    "state": "Massachusetts",
    "slug": "boston",
    "name": "boston"
  },
  {
    "region": "US",
    "state": "Massachusetts",
    "slug": "capecod",
    "name": "cape cod / islands"
  },
  {
    "region": "US",
    "state": "Massachusetts",
    "slug": "southcoast",
    "name": "south coast"
  },
  {
    "region": "US",
    "state": "Massachusetts",
    "slug": "westernmass",
    "name": "western massachusetts"
  },
  {
    "region": "US",
    "state": "Massachusetts",
    "slug": "worcester",
    "name": "worcester / central MA"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "annarbor",
    "name": "ann arbor"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "battlecreek",
    "name": "battle creek"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "centralmich",
    "name": "central michigan"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "detroit",
    "name": "detroit metro"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "flint",
    "name": "flint"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "grandrapids",
    "name": "grand rapids"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "holland",
    "name": "holland"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "jxn",
    "name": "jackson"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "kalamazoo",
    "name": "kalamazoo"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "lansing",
    "name": "lansing"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "monroemi",
    "name": "monroe"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "muskegon",
    "name": "muskegon"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "nmi",
    "name": "northern michigan"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "porthuron",
    "name": "port huron"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "saginaw",
    "name": "saginaw-midland-baycity"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "swmi",
    "name": "southwest michigan"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "thumb",
    "name": "the thumb"
  },
  {
    "region": "US",
    "state": "Michigan",
    "slug": "up",
    "name": "upper peninsula"
  },
  {
    "region": "US",
    "state": "Minnesota",
    "slug": "bemidji",
    "name": "bemidji"
  },
  {
    "region": "US",
    "state": "Minnesota",
    "slug": "brainerd",
    "name": "brainerd"
  },
  {
    "region": "US",
    "state": "Minnesota",
    "slug": "duluth",
    "name": "duluth / superior"
  },
  {
    "region": "US",
    "state": "Minnesota",
    "slug": "mankato",
    "name": "mankato"
  },
  {
    "region": "US",
    "state": "Minnesota",
    "slug": "minneapolis",
    "name": "minneapolis / st paul"
  },
  {
    "region": "US",
    "state": "Minnesota",
    "slug": "rmn",
    "name": "rochester"
  },
  {
    "region": "US",
    "state": "Minnesota",
    "slug": "marshall",
    "name": "southwest MN"
  },
  {
    "region": "US",
    "state": "Minnesota",
    "slug": "stcloud",
    "name": "st cloud"
  },
  {
    "region": "US",
    "state": "Mississippi",
    "slug": "gulfport",
    "name": "gulfport / biloxi"
  },
  {
    "region": "US",
    "state": "Mississippi",
    "slug": "hattiesburg",
    "name": "hattiesburg"
  },
  {
    "region": "US",
    "state": "Mississippi",
    "slug": "jackson",
    "name": "jackson"
  },
  {
    "region": "US",
    "state": "Mississippi",
    "slug": "meridian",
    "name": "meridian"
  },
  {
    "region": "US",
    "state": "Mississippi",
    "slug": "northmiss",
    "name": "north mississippi"
  },
  {
    "region": "US",
    "state": "Mississippi",
    "slug": "natchez",
    "name": "southwest MS"
  },
  {
    "region": "US",
    "state": "Missouri",
    "slug": "columbiamo",
    "name": "columbia / jeff city"
  },
  {
    "region": "US",
    "state": "Missouri",
    "slug": "joplin",
    "name": "joplin"
  },
  {
    "region": "US",
    "state": "Missouri",
    "slug": "kansascity",
    "name": "kansas city"
  },
  {
    "region": "US",
    "state": "Missouri",
    "slug": "kirksville",
    "name": "kirksville"
  },
  {
    "region": "US",
    "state": "Missouri",
    "slug": "loz",
    "name": "lake of the ozarks"
  },
  {
    "region": "US",
    "state": "Missouri",
    "slug": "semo",
    "name": "southeast missouri"
  },
  {
    "region": "US",
    "state": "Missouri",
    "slug": "springfield",
    "name": "springfield"
  },
  {
    "region": "US",
    "state": "Missouri",
    "slug": "stjoseph",
    "name": "st joseph"
  },
  {
    "region": "US",
    "state": "Missouri",
    "slug": "stlouis",
    "name": "st louis"
  },
  {
    "region": "US",
    "state": "Montana",
    "slug": "billings",
    "name": "billings"
  },
  {
    "region": "US",
    "state": "Montana",
    "slug": "bozeman",
    "name": "bozeman"
  },
  {
    "region": "US",
    "state": "Montana",
    "slug": "butte",
    "name": "butte"
  },
  {
    "region": "US",
    "state": "Montana",
    "slug": "greatfalls",
    "name": "great falls"
  },
  {
    "region": "US",
    "state": "Montana",
    "slug": "helena",
    "name": "helena"
  },
  {
    "region": "US",
    "state": "Montana",
    "slug": "kalispell",
    "name": "kalispell"
  },
  {
    "region": "US",
    "state": "Montana",
    "slug": "missoula",
    "name": "missoula"
  },
  {
    "region": "US",
    "state": "Montana",
    "slug": "montana",
    "name": "eastern montana"
  },
  {
    "region": "US",
    "state": "Nebraska",
    "slug": "grandisland",
    "name": "grand island"
  },
  {
    "region": "US",
    "state": "Nebraska",
    "slug": "lincoln",
    "name": "lincoln"
  },
  {
    "region": "US",
    "state": "Nebraska",
    "slug": "northplatte",
    "name": "north platte"
  },
  {
    "region": "US",
    "state": "Nebraska",
    "slug": "omaha",
    "name": "omaha / council bluffs"
  },
  {
    "region": "US",
    "state": "Nebraska",
    "slug": "scottsbluff",
    "name": "scottsbluff / panhandle"
  },
  {
    "region": "US",
    "state": "Nevada",
    "slug": "elko",
    "name": "elko"
  },
  {
    "region": "US",
    "state": "Nevada",
    "slug": "lasvegas",
    "name": "las vegas"
  },
  {
    "region": "US",
    "state": "Nevada",
    "slug": "reno",
    "name": "reno / tahoe"
  },
  {
    "region": "US",
    "state": "New Hampshire",
    "slug": "nh",
    "name": "new hampshire"
  },
  {
    "region": "US",
    "state": "New Jersey",
    "slug": "cnj",
    "name": "central NJ"
  },
  {
    "region": "US",
    "state": "New Jersey",
    "slug": "jerseyshore",
    "name": "jersey shore"
  },
  {
    "region": "US",
    "state": "New Jersey",
    "slug": "newjersey",
    "name": "north jersey"
  },
  {
    "region": "US",
    "state": "New Jersey",
    "slug": "southjersey",
    "name": "south jersey"
  },
  {
    "region": "US",
    "state": "New Mexico",
    "slug": "albuquerque",
    "name": "albuquerque"
  },
  {
    "region": "US",
    "state": "New Mexico",
    "slug": "clovis",
    "name": "clovis / portales"
  },
  {
    "region": "US",
    "state": "New Mexico",
    "slug": "farmington",
    "name": "farmington"
  },
  {
    "region": "US",
    "state": "New Mexico",
    "slug": "lascruces",
    "name": "las cruces"
  },
  {
    "region": "US",
    "state": "New Mexico",
    "slug": "roswell",
    "name": "roswell / carlsbad"
  },
  {
    "region": "US",
    "state": "New Mexico",
    "slug": "santafe",
    "name": "santa fe / taos"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "albany",
    "name": "albany"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "binghamton",
    "name": "binghamton"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "buffalo",
    "name": "buffalo"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "catskills",
    "name": "catskills"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "chautauqua",
    "name": "chautauqua"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "elmira",
    "name": "elmira-corning"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "fingerlakes",
    "name": "finger lakes"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "glensfalls",
    "name": "glens falls"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "hudsonvalley",
    "name": "hudson valley"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "ithaca",
    "name": "ithaca"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "longisland",
    "name": "long island"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "newyork",
    "name": "new york city"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "oneonta",
    "name": "oneonta"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "plattsburgh",
    "name": "plattsburgh-adirondacks"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "potsdam",
    "name": "potsdam-canton-massena"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "rochester",
    "name": "rochester"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "syracuse",
    "name": "syracuse"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "twintiers",
    "name": "twin tiers NY/PA"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "utica",
    "name": "utica-rome-oneida"
  },
  {
    "region": "US",
    "state": "New York",
    "slug": "watertown",
    "name": "watertown"
  },
  {
    "region": "US",
    "state": "North Carolina",
    "slug": "asheville",
    "name": "asheville"
  },
  {
    "region": "US",
    "state": "North Carolina",
    "slug": "boone",
    "name": "boone"
  },
  {
    "region": "US",
    "state": "North Carolina",
    "slug": "charlotte",
    "name": "charlotte"
  },
  {
    "region": "US",
    "state": "North Carolina",
    "slug": "eastnc",
    "name": "eastern NC"
  },
  {
    "region": "US",
    "state": "North Carolina",
    "slug": "fayetteville",
    "name": "fayetteville"
  },
  {
    "region": "US",
    "state": "North Carolina",
    "slug": "greensboro",
    "name": "greensboro"
  },
  {
    "region": "US",
    "state": "North Carolina",
    "slug": "hickory",
    "name": "hickory / lenoir"
  },
  {
    "region": "US",
    "state": "North Carolina",
    "slug": "onslow",
    "name": "jacksonville"
  },
  {
    "region": "US",
    "state": "North Carolina",
    "slug": "outerbanks",
    "name": "outer banks"
  },
  {
    "region": "US",
    "state": "North Carolina",
    "slug": "raleigh",
    "name": "raleigh / durham / CH"
  },
  {
    "region": "US",
    "state": "North Carolina",
    "slug": "wilmington",
    "name": "wilmington"
  },
  {
    "region": "US",
    "state": "North Carolina",
    "slug": "winstonsalem",
    "name": "winston-salem"
  },
  {
    "region": "US",
    "state": "North Dakota",
    "slug": "bismarck",
    "name": "bismarck"
  },
  {
    "region": "US",
    "state": "North Dakota",
    "slug": "fargo",
    "name": "fargo / moorhead"
  },
  {
    "region": "US",
    "state": "North Dakota",
    "slug": "grandforks",
    "name": "grand forks"
  },
  {
    "region": "US",
    "state": "North Dakota",
    "slug": "nd",
    "name": "north dakota"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "akroncanton",
    "name": "akron / canton"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "ashtabula",
    "name": "ashtabula"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "athensohio",
    "name": "athens"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "chillicothe",
    "name": "chillicothe"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "cincinnati",
    "name": "cincinnati"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "cleveland",
    "name": "cleveland"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "columbus",
    "name": "columbus"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "dayton",
    "name": "dayton / springfield"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "limaohio",
    "name": "lima / findlay"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "mansfield",
    "name": "mansfield"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "sandusky",
    "name": "sandusky"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "toledo",
    "name": "toledo"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "tuscarawas",
    "name": "tuscarawas co"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "youngstown",
    "name": "youngstown"
  },
  {
    "region": "US",
    "state": "Ohio",
    "slug": "zanesville",
    "name": "zanesville / cambridge"
  },
  {
    "region": "US",
    "state": "Oklahoma",
    "slug": "lawton",
    "name": "lawton"
  },
  {
    "region": "US",
    "state": "Oklahoma",
    "slug": "enid",
    "name": "northwest OK"
  },
  {
    "region": "US",
    "state": "Oklahoma",
    "slug": "oklahomacity",
    "name": "oklahoma city"
  },
  {
    "region": "US",
    "state": "Oklahoma",
    "slug": "stillwater",
    "name": "stillwater"
  },
  {
    "region": "US",
    "state": "Oklahoma",
    "slug": "tulsa",
    "name": "tulsa"
  },
  {
    "region": "US",
    "state": "Oregon",
    "slug": "bend",
    "name": "bend"
  },
  {
    "region": "US",
    "state": "Oregon",
    "slug": "corvallis",
    "name": "corvallis/albany"
  },
  {
    "region": "US",
    "state": "Oregon",
    "slug": "eastoregon",
    "name": "east oregon"
  },
  {
    "region": "US",
    "state": "Oregon",
    "slug": "eugene",
    "name": "eugene"
  },
  {
    "region": "US",
    "state": "Oregon",
    "slug": "klamath",
    "name": "klamath falls"
  },
  {
    "region": "US",
    "state": "Oregon",
    "slug": "medford",
    "name": "medford-ashland"
  },
  {
    "region": "US",
    "state": "Oregon",
    "slug": "oregoncoast",
    "name": "oregon coast"
  },
  {
    "region": "US",
    "state": "Oregon",
    "slug": "portland",
    "name": "portland"
  },
  {
    "region": "US",
    "state": "Oregon",
    "slug": "roseburg",
    "name": "roseburg"
  },
  {
    "region": "US",
    "state": "Oregon",
    "slug": "salem",
    "name": "salem"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "altoona",
    "name": "altoona-johnstown"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "chambersburg",
    "name": "cumberland valley"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "erie",
    "name": "erie"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "harrisburg",
    "name": "harrisburg"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "lancaster",
    "name": "lancaster"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "allentown",
    "name": "lehigh valley"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "meadville",
    "name": "meadville"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "philadelphia",
    "name": "philadelphia"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "pittsburgh",
    "name": "pittsburgh"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "poconos",
    "name": "poconos"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "reading",
    "name": "reading"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "scranton",
    "name": "scranton / wilkes-barre"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "pennstate",
    "name": "state college"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "williamsport",
    "name": "williamsport"
  },
  {
    "region": "US",
    "state": "Pennsylvania",
    "slug": "york",
    "name": "york"
  },
  {
    "region": "US",
    "state": "Rhode Island",
    "slug": "providence",
    "name": "rhode island"
  },
  {
    "region": "US",
    "state": "South Carolina",
    "slug": "charleston",
    "name": "charleston"
  },
  {
    "region": "US",
    "state": "South Carolina",
    "slug": "columbia",
    "name": "columbia"
  },
  {
    "region": "US",
    "state": "South Carolina",
    "slug": "florencesc",
    "name": "florence"
  },
  {
    "region": "US",
    "state": "South Carolina",
    "slug": "greenville",
    "name": "greenville / upstate"
  },
  {
    "region": "US",
    "state": "South Carolina",
    "slug": "hiltonhead",
    "name": "hilton head"
  },
  {
    "region": "US",
    "state": "South Carolina",
    "slug": "myrtlebeach",
    "name": "myrtle beach"
  },
  {
    "region": "US",
    "state": "South Dakota",
    "slug": "nesd",
    "name": "northeast SD"
  },
  {
    "region": "US",
    "state": "South Dakota",
    "slug": "csd",
    "name": "pierre / central SD"
  },
  {
    "region": "US",
    "state": "South Dakota",
    "slug": "rapidcity",
    "name": "rapid city / west SD"
  },
  {
    "region": "US",
    "state": "South Dakota",
    "slug": "siouxfalls",
    "name": "sioux falls / SE SD"
  },
  {
    "region": "US",
    "state": "South Dakota",
    "slug": "sd",
    "name": "south dakota"
  },
  {
    "region": "US",
    "state": "Tennessee",
    "slug": "chattanooga",
    "name": "chattanooga"
  },
  {
    "region": "US",
    "state": "Tennessee",
    "slug": "clarksville",
    "name": "clarksville"
  },
  {
    "region": "US",
    "state": "Tennessee",
    "slug": "cookeville",
    "name": "cookeville"
  },
  {
    "region": "US",
    "state": "Tennessee",
    "slug": "jacksontn",
    "name": "jackson"
  },
  {
    "region": "US",
    "state": "Tennessee",
    "slug": "knoxville",
    "name": "knoxville"
  },
  {
    "region": "US",
    "state": "Tennessee",
    "slug": "memphis",
    "name": "memphis"
  },
  {
    "region": "US",
    "state": "Tennessee",
    "slug": "nashville",
    "name": "nashville"
  },
  {
    "region": "US",
    "state": "Tennessee",
    "slug": "tricities",
    "name": "tri-cities"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "abilene",
    "name": "abilene"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "amarillo",
    "name": "amarillo"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "austin",
    "name": "austin"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "beaumont",
    "name": "beaumont / port arthur"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "brownsville",
    "name": "brownsville"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "collegestation",
    "name": "college station"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "corpuschristi",
    "name": "corpus christi"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "dallas",
    "name": "dallas / fort worth"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "nacogdoches",
    "name": "deep east texas"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "delrio",
    "name": "del rio / eagle pass"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "elpaso",
    "name": "el paso"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "galveston",
    "name": "galveston"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "houston",
    "name": "houston"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "killeen",
    "name": "killeen / temple / ft hood"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "laredo",
    "name": "laredo"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "lubbock",
    "name": "lubbock"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "mcallen",
    "name": "mcallen / edinburg"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "odessa",
    "name": "odessa / midland"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "sanangelo",
    "name": "san angelo"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "sanantonio",
    "name": "san antonio"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "sanmarcos",
    "name": "san marcos"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "bigbend",
    "name": "southwest TX"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "texoma",
    "name": "texoma"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "easttexas",
    "name": "tyler / east TX"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "victoriatx",
    "name": "victoria"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "waco",
    "name": "waco"
  },
  {
    "region": "US",
    "state": "Texas",
    "slug": "wichitafalls",
    "name": "wichita falls"
  },
  {
    "region": "US",
    "state": "Utah",
    "slug": "logan",
    "name": "logan"
  },
  {
    "region": "US",
    "state": "Utah",
    "slug": "ogden",
    "name": "ogden-clearfield"
  },
  {
    "region": "US",
    "state": "Utah",
    "slug": "provo",
    "name": "provo / orem"
  },
  {
    "region": "US",
    "state": "Utah",
    "slug": "saltlakecity",
    "name": "salt lake city"
  },
  {
    "region": "US",
    "state": "Utah",
    "slug": "stgeorge",
    "name": "st george"
  },
  {
    "region": "US",
    "state": "Vermont",
    "slug": "vermont",
    "name": "vermont"
  },
  {
    "region": "US",
    "state": "Virginia",
    "slug": "charlottesville",
    "name": "charlottesville"
  },
  {
    "region": "US",
    "state": "Virginia",
    "slug": "danville",
    "name": "danville"
  },
  {
    "region": "US",
    "state": "Virginia",
    "slug": "fredericksburg",
    "name": "fredericksburg"
  },
  {
    "region": "US",
    "state": "Virginia",
    "slug": "norfolk",
    "name": "hampton roads"
  },
  {
    "region": "US",
    "state": "Virginia",
    "slug": "harrisonburg",
    "name": "harrisonburg"
  },
  {
    "region": "US",
    "state": "Virginia",
    "slug": "lynchburg",
    "name": "lynchburg"
  },
  {
    "region": "US",
    "state": "Virginia",
    "slug": "blacksburg",
    "name": "new river valley"
  },
  {
    "region": "US",
    "state": "Virginia",
    "slug": "richmond",
    "name": "richmond"
  },
  {
    "region": "US",
    "state": "Virginia",
    "slug": "roanoke",
    "name": "roanoke"
  },
  {
    "region": "US",
    "state": "Virginia",
    "slug": "swva",
    "name": "southwest VA"
  },
  {
    "region": "US",
    "state": "Virginia",
    "slug": "winchester",
    "name": "winchester"
  },
  {
    "region": "US",
    "state": "Washington",
    "slug": "bellingham",
    "name": "bellingham"
  },
  {
    "region": "US",
    "state": "Washington",
    "slug": "kpr",
    "name": "kennewick-pasco-richland"
  },
  {
    "region": "US",
    "state": "Washington",
    "slug": "moseslake",
    "name": "moses lake"
  },
  {
    "region": "US",
    "state": "Washington",
    "slug": "olympic",
    "name": "olympic peninsula"
  },
  {
    "region": "US",
    "state": "Washington",
    "slug": "pullman",
    "name": "pullman / moscow"
  },
  {
    "region": "US",
    "state": "Washington",
    "slug": "seattle",
    "name": "seattle-tacoma"
  },
  {
    "region": "US",
    "state": "Washington",
    "slug": "skagit",
    "name": "skagit / island / SJI"
  },
  {
    "region": "US",
    "state": "Washington",
    "slug": "spokane",
    "name": "spokane / coeur d'alene"
  },
  {
    "region": "US",
    "state": "Washington",
    "slug": "wenatchee",
    "name": "wenatchee"
  },
  {
    "region": "US",
    "state": "Washington",
    "slug": "yakima",
    "name": "yakima"
  },
  {
    "region": "US",
    "state": "West Virginia",
    "slug": "charlestonwv",
    "name": "charleston"
  },
  {
    "region": "US",
    "state": "West Virginia",
    "slug": "martinsburg",
    "name": "eastern panhandle"
  },
  {
    "region": "US",
    "state": "West Virginia",
    "slug": "huntington",
    "name": "huntington-ashland"
  },
  {
    "region": "US",
    "state": "West Virginia",
    "slug": "morgantown",
    "name": "morgantown"
  },
  {
    "region": "US",
    "state": "West Virginia",
    "slug": "wheeling",
    "name": "northern panhandle"
  },
  {
    "region": "US",
    "state": "West Virginia",
    "slug": "parkersburg",
    "name": "parkersburg-marietta"
  },
  {
    "region": "US",
    "state": "West Virginia",
    "slug": "swv",
    "name": "southern WV"
  },
  {
    "region": "US",
    "state": "West Virginia",
    "slug": "wv",
    "name": "west virginia (old)"
  },
  {
    "region": "US",
    "state": "Wisconsin",
    "slug": "appleton",
    "name": "appleton-oshkosh-FDL"
  },
  {
    "region": "US",
    "state": "Wisconsin",
    "slug": "eauclaire",
    "name": "eau claire"
  },
  {
    "region": "US",
    "state": "Wisconsin",
    "slug": "greenbay",
    "name": "green bay"
  },
  {
    "region": "US",
    "state": "Wisconsin",
    "slug": "janesville",
    "name": "janesville"
  },
  {
    "region": "US",
    "state": "Wisconsin",
    "slug": "racine",
    "name": "kenosha-racine"
  },
  {
    "region": "US",
    "state": "Wisconsin",
    "slug": "lacrosse",
    "name": "la crosse"
  },
  {
    "region": "US",
    "state": "Wisconsin",
    "slug": "madison",
    "name": "madison"
  },
  {
    "region": "US",
    "state": "Wisconsin",
    "slug": "milwaukee",
    "name": "milwaukee"
  },
  {
    "region": "US",
    "state": "Wisconsin",
    "slug": "northernwi",
    "name": "northern WI"
  },
  {
    "region": "US",
    "state": "Wisconsin",
    "slug": "sheboygan",
    "name": "sheboygan"
  },
  {
    "region": "US",
    "state": "Wisconsin",
    "slug": "wausau",
    "name": "wausau"
  },
  {
    "region": "US",
    "state": "Wyoming",
    "slug": "wyoming",
    "name": "wyoming"
  },
  {
    "region": "US",
    "state": "Territories",
    "slug": "micronesia",
    "name": "guam-micronesia"
  },
  {
    "region": "US",
    "state": "Territories",
    "slug": "puertorico",
    "name": "puerto rico"
  },
  {
    "region": "US",
    "state": "Territories",
    "slug": "virgin",
    "name": "U.S. virgin islands"
  },
  {
    "region": "Canada",
    "state": "Alberta",
    "slug": "calgary",
    "name": "calgary"
  },
  {
    "region": "Canada",
    "state": "Alberta",
    "slug": "edmonton",
    "name": "edmonton"
  },
  {
    "region": "Canada",
    "state": "Alberta",
    "slug": "ftmcmurray",
    "name": "ft mcmurray"
  },
  {
    "region": "Canada",
    "state": "Alberta",
    "slug": "lethbridge",
    "name": "lethbridge"
  },
  {
    "region": "Canada",
    "state": "Alberta",
    "slug": "hat",
    "name": "medicine hat"
  },
  {
    "region": "Canada",
    "state": "Alberta",
    "slug": "peace",
    "name": "peace river country"
  },
  {
    "region": "Canada",
    "state": "Alberta",
    "slug": "reddeer",
    "name": "red deer"
  },
  {
    "region": "Canada",
    "state": "British Columbia",
    "slug": "cariboo",
    "name": "cariboo"
  },
  {
    "region": "Canada",
    "state": "British Columbia",
    "slug": "comoxvalley",
    "name": "comox valley"
  },
  {
    "region": "Canada",
    "state": "British Columbia",
    "slug": "abbotsford",
    "name": "fraser valley"
  },
  {
    "region": "Canada",
    "state": "British Columbia",
    "slug": "kamloops",
    "name": "kamloops"
  },
  {
    "region": "Canada",
    "state": "British Columbia",
    "slug": "kelowna",
    "name": "kelowna / okanagan"
  },
  {
    "region": "Canada",
    "state": "British Columbia",
    "slug": "kootenays",
    "name": "kootenays"
  },
  {
    "region": "Canada",
    "state": "British Columbia",
    "slug": "nanaimo",
    "name": "nanaimo"
  },
  {
    "region": "Canada",
    "state": "British Columbia",
    "slug": "princegeorge",
    "name": "prince george"
  },
  {
    "region": "Canada",
    "state": "British Columbia",
    "slug": "skeena",
    "name": "skeena-bulkley"
  },
  {
    "region": "Canada",
    "state": "British Columbia",
    "slug": "sunshine",
    "name": "sunshine coast"
  },
  {
    "region": "Canada",
    "state": "British Columbia",
    "slug": "vancouver",
    "name": "vancouver"
  },
  {
    "region": "Canada",
    "state": "British Columbia",
    "slug": "victoria",
    "name": "victoria"
  },
  {
    "region": "Canada",
    "state": "British Columbia",
    "slug": "whistler",
    "name": "whistler"
  },
  {
    "region": "Canada",
    "state": "Manitoba",
    "slug": "winnipeg",
    "name": "winnipeg"
  },
  {
    "region": "Canada",
    "state": "New Brunswick",
    "slug": "newbrunswick",
    "name": "new brunswick"
  },
  {
    "region": "Canada",
    "state": "Newfoundland and Labrador",
    "slug": "newfoundland",
    "name": "st john's"
  },
  {
    "region": "Canada",
    "state": "Northwest Territories",
    "slug": "territories",
    "name": "territories"
  },
  {
    "region": "Canada",
    "state": "Northwest Territories",
    "slug": "yellowknife",
    "name": "yellowknife"
  },
  {
    "region": "Canada",
    "state": "Nova Scotia",
    "slug": "halifax",
    "name": "halifax"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "barrie",
    "name": "barrie"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "belleville",
    "name": "belleville"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "brantford",
    "name": "brantford-woodstock"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "chatham",
    "name": "chatham-kent"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "cornwall",
    "name": "cornwall"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "guelph",
    "name": "guelph"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "hamilton",
    "name": "hamilton-burlington"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "kingston",
    "name": "kingston"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "kitchener",
    "name": "kitchener-waterloo-cambridge"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "londonon",
    "name": "london"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "niagara",
    "name": "niagara region"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "ottawa",
    "name": "ottawa-hull-gatineau"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "owensound",
    "name": "owen sound"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "peterborough",
    "name": "peterborough"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "sarnia",
    "name": "sarnia"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "soo",
    "name": "sault ste marie"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "sudbury",
    "name": "sudbury"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "thunderbay",
    "name": "thunder bay"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "toronto",
    "name": "toronto"
  },
  {
    "region": "Canada",
    "state": "Ontario",
    "slug": "windsor",
    "name": "windsor"
  },
  {
    "region": "Canada",
    "state": "Prince Edward Island",
    "slug": "pei",
    "name": "prince edward island"
  },
  {
    "region": "Canada",
    "state": "Quebec",
    "slug": "montreal",
    "name": "montreal"
  },
  {
    "region": "Canada",
    "state": "Quebec",
    "slug": "quebec",
    "name": "quebec city"
  },
  {
    "region": "Canada",
    "state": "Quebec",
    "slug": "saguenay",
    "name": "saguenay"
  },
  {
    "region": "Canada",
    "state": "Quebec",
    "slug": "sherbrooke",
    "name": "sherbrooke"
  },
  {
    "region": "Canada",
    "state": "Quebec",
    "slug": "troisrivieres",
    "name": "trois-rivieres"
  },
  {
    "region": "Canada",
    "state": "Saskatchewan",
    "slug": "regina",
    "name": "regina"
  },
  {
    "region": "Canada",
    "state": "Saskatchewan",
    "slug": "saskatoon",
    "name": "saskatoon"
  },
  {
    "region": "Canada",
    "state": "Yukon Territory",
    "slug": "whitehorse",
    "name": "whitehorse"
  },
  {
    "region": "Europe",
    "state": "Austria",
    "slug": "vienna",
    "name": "vienna"
  },
  {
    "region": "Europe",
    "state": "Belgium",
    "slug": "brussels",
    "name": "belgium"
  },
  {
    "region": "Europe",
    "state": "Bulgaria",
    "slug": "bulgaria",
    "name": "bulgaria"
  },
  {
    "region": "Europe",
    "state": "Croatia",
    "slug": "zagreb",
    "name": "croatia"
  },
  {
    "region": "Europe",
    "state": "Czech Republic",
    "slug": "prague",
    "name": "prague"
  },
  {
    "region": "Europe",
    "state": "Denmark",
    "slug": "copenhagen",
    "name": "copenhagen"
  },
  {
    "region": "Europe",
    "state": "Finland",
    "slug": "helsinki",
    "name": "finland"
  },
  {
    "region": "Europe",
    "state": "France",
    "slug": "bordeaux",
    "name": "bordeaux"
  },
  {
    "region": "Europe",
    "state": "France",
    "slug": "rennes",
    "name": "brittany"
  },
  {
    "region": "Europe",
    "state": "France",
    "slug": "grenoble",
    "name": "grenoble"
  },
  {
    "region": "Europe",
    "state": "France",
    "slug": "lille",
    "name": "lille"
  },
  {
    "region": "Europe",
    "state": "France",
    "slug": "loire",
    "name": "loire valley"
  },
  {
    "region": "Europe",
    "state": "France",
    "slug": "lyon",
    "name": "lyon"
  },
  {
    "region": "Europe",
    "state": "France",
    "slug": "marseilles",
    "name": "marseille"
  },
  {
    "region": "Europe",
    "state": "France",
    "slug": "montpellier",
    "name": "montpellier"
  },
  {
    "region": "Europe",
    "state": "France",
    "slug": "cotedazur",
    "name": "nice / cote d'azur"
  },
  {
    "region": "Europe",
    "state": "France",
    "slug": "rouen",
    "name": "normandy"
  },
  {
    "region": "Europe",
    "state": "France",
    "slug": "paris",
    "name": "paris"
  },
  {
    "region": "Europe",
    "state": "France",
    "slug": "strasbourg",
    "name": "strasbourg"
  },
  {
    "region": "Europe",
    "state": "France",
    "slug": "toulouse",
    "name": "toulouse"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "berlin",
    "name": "berlin"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "bremen",
    "name": "bremen"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "cologne",
    "name": "cologne"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "dresden",
    "name": "dresden"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "dusseldorf",
    "name": "dusseldorf"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "essen",
    "name": "essen / ruhr"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "frankfurt",
    "name": "frankfurt"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "hamburg",
    "name": "hamburg"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "hannover",
    "name": "hannover"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "heidelberg",
    "name": "heidelberg"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "kaiserslautern",
    "name": "kaiserslautern"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "leipzig",
    "name": "leipzig"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "munich",
    "name": "munich"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "nuremberg",
    "name": "nuremberg"
  },
  {
    "region": "Europe",
    "state": "Germany",
    "slug": "stuttgart",
    "name": "stuttgart"
  },
  {
    "region": "Europe",
    "state": "Greece",
    "slug": "athens",
    "name": "greece"
  },
  {
    "region": "Europe",
    "state": "Hungary",
    "slug": "budapest",
    "name": "budapest"
  },
  {
    "region": "Europe",
    "state": "Iceland",
    "slug": "reykjavik",
    "name": "reykjavik"
  },
  {
    "region": "Europe",
    "state": "Ireland",
    "slug": "dublin",
    "name": "dublin"
  },
  {
    "region": "Europe",
    "state": "Italy",
    "slug": "bologna",
    "name": "bologna"
  },
  {
    "region": "Europe",
    "state": "Italy",
    "slug": "florence",
    "name": "florence / tuscany"
  },
  {
    "region": "Europe",
    "state": "Italy",
    "slug": "genoa",
    "name": "genoa"
  },
  {
    "region": "Europe",
    "state": "Italy",
    "slug": "milan",
    "name": "milan"
  },
  {
    "region": "Europe",
    "state": "Italy",
    "slug": "naples",
    "name": "napoli / campania"
  },
  {
    "region": "Europe",
    "state": "Italy",
    "slug": "perugia",
    "name": "perugia"
  },
  {
    "region": "Europe",
    "state": "Italy",
    "slug": "rome",
    "name": "rome"
  },
  {
    "region": "Europe",
    "state": "Italy",
    "slug": "sardinia",
    "name": "sardinia"
  },
  {
    "region": "Europe",
    "state": "Italy",
    "slug": "sicily",
    "name": "sicilia"
  },
  {
    "region": "Europe",
    "state": "Italy",
    "slug": "torino",
    "name": "torino"
  },
  {
    "region": "Europe",
    "state": "Italy",
    "slug": "venice",
    "name": "venice / veneto"
  },
  {
    "region": "Europe",
    "state": "Luxembourg",
    "slug": "luxembourg",
    "name": "luxembourg"
  },
  {
    "region": "Europe",
    "state": "Netherlands",
    "slug": "amsterdam",
    "name": "amsterdam / randstad"
  },
  {
    "region": "Europe",
    "state": "Norway",
    "slug": "oslo",
    "name": "norway"
  },
  {
    "region": "Europe",
    "state": "Poland",
    "slug": "warsaw",
    "name": "poland"
  },
  {
    "region": "Europe",
    "state": "Portugal",
    "slug": "faro",
    "name": "faro / algarve"
  },
  {
    "region": "Europe",
    "state": "Portugal",
    "slug": "lisbon",
    "name": "lisbon"
  },
  {
    "region": "Europe",
    "state": "Portugal",
    "slug": "porto",
    "name": "porto"
  },
  {
    "region": "Europe",
    "state": "Romania",
    "slug": "bucharest",
    "name": "romania"
  },
  {
    "region": "Europe",
    "state": "Russian Federation",
    "slug": "moscow",
    "name": "moscow"
  },
  {
    "region": "Europe",
    "state": "Russian Federation",
    "slug": "stpetersburg",
    "name": "st petersburg"
  },
  {
    "region": "Europe",
    "state": "Spain",
    "slug": "alicante",
    "name": "alicante"
  },
  {
    "region": "Europe",
    "state": "Spain",
    "slug": "baleares",
    "name": "baleares"
  },
  {
    "region": "Europe",
    "state": "Spain",
    "slug": "barcelona",
    "name": "barcelona"
  },
  {
    "region": "Europe",
    "state": "Spain",
    "slug": "bilbao",
    "name": "bilbao"
  },
  {
    "region": "Europe",
    "state": "Spain",
    "slug": "cadiz",
    "name": "cadiz"
  },
  {
    "region": "Europe",
    "state": "Spain",
    "slug": "canarias",
    "name": "canarias"
  },
  {
    "region": "Europe",
    "state": "Spain",
    "slug": "granada",
    "name": "granada"
  },
  {
    "region": "Europe",
    "state": "Spain",
    "slug": "madrid",
    "name": "madrid"
  },
  {
    "region": "Europe",
    "state": "Spain",
    "slug": "malaga",
    "name": "malaga"
  },
  {
    "region": "Europe",
    "state": "Spain",
    "slug": "sevilla",
    "name": "sevilla"
  },
  {
    "region": "Europe",
    "state": "Spain",
    "slug": "valencia",
    "name": "valencia"
  },
  {
    "region": "Europe",
    "state": "Sweden",
    "slug": "stockholm",
    "name": "sweden"
  },
  {
    "region": "Europe",
    "state": "Switzerland",
    "slug": "basel",
    "name": "basel"
  },
  {
    "region": "Europe",
    "state": "Switzerland",
    "slug": "bern",
    "name": "bern"
  },
  {
    "region": "Europe",
    "state": "Switzerland",
    "slug": "geneva",
    "name": "geneva"
  },
  {
    "region": "Europe",
    "state": "Switzerland",
    "slug": "lausanne",
    "name": "lausanne"
  },
  {
    "region": "Europe",
    "state": "Switzerland",
    "slug": "zurich",
    "name": "zurich"
  },
  {
    "region": "Europe",
    "state": "Turkey",
    "slug": "istanbul",
    "name": "turkey"
  },
  {
    "region": "Europe",
    "state": "Ukraine",
    "slug": "ukraine",
    "name": "ukraine"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "aberdeen",
    "name": "aberdeen"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "bath",
    "name": "bath"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "belfast",
    "name": "belfast"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "birmingham",
    "name": "birmingham / west mids"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "brighton",
    "name": "brighton"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "bristol",
    "name": "bristol"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "cambridge",
    "name": "cambridge, UK"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "cardiff",
    "name": "cardiff / wales"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "coventry",
    "name": "coventry"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "derby",
    "name": "derby"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "devon",
    "name": "devon & cornwall"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "dundee",
    "name": "dundee"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "norwich",
    "name": "east anglia"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "eastmids",
    "name": "east midlands"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "edinburgh",
    "name": "edinburgh"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "essex",
    "name": "essex"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "glasgow",
    "name": "glasgow"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "hampshire",
    "name": "hampshire"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "kent",
    "name": "kent"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "leeds",
    "name": "leeds"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "liverpool",
    "name": "liverpool"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "london",
    "name": "london"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "manchester",
    "name": "manchester"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "newcastle",
    "name": "newcastle / NE england"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "nottingham",
    "name": "nottingham"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "oxford",
    "name": "oxford"
  },
  {
    "region": "Europe",
    "state": "United Kingdom",
    "slug": "sheffield",
    "name": "sheffield"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Bangladesh",
    "slug": "bangladesh",
    "name": "bangladesh"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "China",
    "slug": "beijing",
    "name": "beijing"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "China",
    "slug": "chengdu",
    "name": "chengdu"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "China",
    "slug": "chongqing",
    "name": "chongqing"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "China",
    "slug": "dalian",
    "name": "dalian"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "China",
    "slug": "guangzhou",
    "name": "guangzhou"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "China",
    "slug": "hangzhou",
    "name": "hangzhou"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "China",
    "slug": "nanjing",
    "name": "nanjing"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "China",
    "slug": "shanghai",
    "name": "shanghai"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "China",
    "slug": "shenyang",
    "name": "shenyang"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "China",
    "slug": "shenzhen",
    "name": "shenzhen"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "China",
    "slug": "wuhan",
    "name": "wuhan"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "China",
    "slug": "xian",
    "name": "xi'an"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Hong Kong",
    "slug": "hongkong",
    "name": "hong kong"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "ahmedabad",
    "name": "ahmedabad"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "bangalore",
    "name": "bangalore"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "bhubaneswar",
    "name": "bhubaneswar"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "chandigarh",
    "name": "chandigarh"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "chennai",
    "name": "chennai (madras)"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "delhi",
    "name": "delhi"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "goa",
    "name": "goa"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "hyderabad",
    "name": "hyderabad"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "indore",
    "name": "indore"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "jaipur",
    "name": "jaipur"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "kerala",
    "name": "kerala"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "kolkata",
    "name": "kolkata (calcutta)"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "lucknow",
    "name": "lucknow"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "mumbai",
    "name": "mumbai"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "pune",
    "name": "pune"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "India",
    "slug": "surat",
    "name": "surat surat"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Indonesia",
    "slug": "jakarta",
    "name": "indonesia"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Iran",
    "slug": "tehran",
    "name": "iran"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Iraq",
    "slug": "baghdad",
    "name": "iraq"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Israel and Palestine",
    "slug": "haifa",
    "name": "haifa"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Israel and Palestine",
    "slug": "jerusalem",
    "name": "jerusalem"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Israel and Palestine",
    "slug": "telaviv",
    "name": "tel aviv"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Israel and Palestine",
    "slug": "ramallah",
    "name": "west bank"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Japan",
    "slug": "fukuoka",
    "name": "fukuoka"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Japan",
    "slug": "hiroshima",
    "name": "hiroshima"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Japan",
    "slug": "nagoya",
    "name": "nagoya"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Japan",
    "slug": "okinawa",
    "name": "okinawa"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Japan",
    "slug": "osaka",
    "name": "osaka-kobe-kyoto"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Japan",
    "slug": "sapporo",
    "name": "sapporo"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Japan",
    "slug": "sendai",
    "name": "sendai"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Japan",
    "slug": "tokyo",
    "name": "tokyo"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Korea",
    "slug": "seoul",
    "name": "seoul"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Kuwait",
    "slug": "kuwait",
    "name": "kuwait"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Lebanon",
    "slug": "beirut",
    "name": "beirut, lebanon"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Malaysia",
    "slug": "malaysia",
    "name": "malaysia"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Pakistan",
    "slug": "pakistan",
    "name": "pakistan"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Philippines",
    "slug": "bacolod",
    "name": "bacolod"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Philippines",
    "slug": "naga",
    "name": "bicol region"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Philippines",
    "slug": "cdo",
    "name": "cagayan de oro"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Philippines",
    "slug": "cebu",
    "name": "cebu"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Philippines",
    "slug": "davaocity",
    "name": "davao city"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Philippines",
    "slug": "iloilo",
    "name": "iloilo"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Philippines",
    "slug": "manila",
    "name": "manila"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Philippines",
    "slug": "pampanga",
    "name": "pampanga"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Philippines",
    "slug": "zamboanga",
    "name": "zamboanga"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Singapore",
    "slug": "singapore",
    "name": "singapore"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Taiwan",
    "slug": "taipei",
    "name": "taiwan"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Thailand",
    "slug": "bangkok",
    "name": "thailand"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "United Arab Emirates",
    "slug": "dubai",
    "name": "united arab emirates"
  },
  {
    "region": "Asia, Pacific and Middle East",
    "state": "Vietnam",
    "slug": "vietnam",
    "name": "vietnam"
  },
  {
    "region": "Oceania",
    "state": "Australia",
    "slug": "adelaide",
    "name": "adelaide"
  },
  {
    "region": "Oceania",
    "state": "Australia",
    "slug": "brisbane",
    "name": "brisbane"
  },
  {
    "region": "Oceania",
    "state": "Australia",
    "slug": "cairns",
    "name": "cairns"
  },
  {
    "region": "Oceania",
    "state": "Australia",
    "slug": "canberra",
    "name": "canberra"
  },
  {
    "region": "Oceania",
    "state": "Australia",
    "slug": "darwin",
    "name": "darwin"
  },
  {
    "region": "Oceania",
    "state": "Australia",
    "slug": "goldcoast",
    "name": "gold coast"
  },
  {
    "region": "Oceania",
    "state": "Australia",
    "slug": "melbourne",
    "name": "melbourne"
  },
  {
    "region": "Oceania",
    "state": "Australia",
    "slug": "ntl",
    "name": "newcastle, NSW"
  },
  {
    "region": "Oceania",
    "state": "Australia",
    "slug": "perth",
    "name": "perth"
  },
  {
    "region": "Oceania",
    "state": "Australia",
    "slug": "sydney",
    "name": "sydney"
  },
  {
    "region": "Oceania",
    "state": "Australia",
    "slug": "hobart",
    "name": "tasmania"
  },
  {
    "region": "Oceania",
    "state": "Australia",
    "slug": "wollongong",
    "name": "wollongong"
  },
  {
    "region": "Oceania",
    "state": "New Zealand",
    "slug": "auckland",
    "name": "auckland"
  },
  {
    "region": "Oceania",
    "state": "New Zealand",
    "slug": "christchurch",
    "name": "christchurch"
  },
  {
    "region": "Oceania",
    "state": "New Zealand",
    "slug": "dunedin",
    "name": "dunedin"
  },
  {
    "region": "Oceania",
    "state": "New Zealand",
    "slug": "wellington",
    "name": "wellington"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Argentina",
    "slug": "buenosaires",
    "name": "buenos aires"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Bolivia",
    "slug": "lapaz",
    "name": "bolivia"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Brazil",
    "slug": "belohorizonte",
    "name": "belo horizonte"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Brazil",
    "slug": "brasilia",
    "name": "brasilia"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Brazil",
    "slug": "curitiba",
    "name": "curitiba"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Brazil",
    "slug": "fortaleza",
    "name": "fortaleza"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Brazil",
    "slug": "portoalegre",
    "name": "porto alegre"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Brazil",
    "slug": "recife",
    "name": "recife"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Brazil",
    "slug": "rio",
    "name": "rio de janeiro"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Brazil",
    "slug": "salvador",
    "name": "salvador, bahia"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Brazil",
    "slug": "saopaulo",
    "name": "sao paulo"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Caribbean Islands",
    "slug": "caribbean",
    "name": "caribbean islands"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Chile",
    "slug": "santiago",
    "name": "chile"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Colombia",
    "slug": "colombia",
    "name": "colombia"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Costa Rica",
    "slug": "costarica",
    "name": "costa rica"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Dominican Republic",
    "slug": "santodomingo",
    "name": "dominican republic"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Ecuador",
    "slug": "quito",
    "name": "ecuador"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "El Salvador",
    "slug": "elsalvador",
    "name": "el salvador"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Guatemala",
    "slug": "guatemala",
    "name": "guatemala"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "acapulco",
    "name": "acapulco"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "bajasur",
    "name": "baja california sur"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "chihuahua",
    "name": "chihuahua"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "juarez",
    "name": "ciudad juarez"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "guadalajara",
    "name": "guadalajara"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "guanajuato",
    "name": "guanajuato"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "hermosillo",
    "name": "hermosillo"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "mazatlan",
    "name": "mazatlan"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "mexicocity",
    "name": "mexico city"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "monterrey",
    "name": "monterrey"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "oaxaca",
    "name": "oaxaca"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "puebla",
    "name": "puebla"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "pv",
    "name": "puerto vallarta"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "tijuana",
    "name": "tijuana"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "veracruz",
    "name": "veracruz"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Mexico",
    "slug": "yucatan",
    "name": "yucatan"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Nicaragua",
    "slug": "managua",
    "name": "nicaragua"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Panama",
    "slug": "panama",
    "name": "panama"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Peru",
    "slug": "lima",
    "name": "peru"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Uruguay",
    "slug": "montevideo",
    "name": "montevideo"
  },
  {
    "region": "Latin America and Caribbean",
    "state": "Venezuela",
    "slug": "caracas",
    "name": "venezuela"
  },
  {
    "region": "Africa",
    "state": "Egypt",
    "slug": "cairo",
    "name": "egypt"
  },
  {
    "region": "Africa",
    "state": "Ethiopia",
    "slug": "addisababa",
    "name": "ethiopia"
  },
  {
    "region": "Africa",
    "state": "Ghana",
    "slug": "accra",
    "name": "ghana"
  },
  {
    "region": "Africa",
    "state": "Kenya",
    "slug": "kenya",
    "name": "kenya"
  },
  {
    "region": "Africa",
    "state": "Morocco",
    "slug": "casablanca",
    "name": "morocco"
  },
  {
    "region": "Africa",
    "state": "South Africa",
    "slug": "capetown",
    "name": "cape town"
  },
  {
    "region": "Africa",
    "state": "South Africa",
    "slug": "durban",
    "name": "durban"
  },
  {
    "region": "Africa",
    "state": "South Africa",
    "slug": "johannesburg",
    "name": "johannesburg"
  },
  {
    "region": "Africa",
    "state": "South Africa",
    "slug": "pretoria",
    "name": "pretoria"
  },
  {
    "region": "Africa",
    "state": "Tunisia",
    "slug": "tunis",
    "name": "tunisia"
  }
];

module.exports = craigslistLocations;
