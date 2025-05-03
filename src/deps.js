// our window object for accessing globals
const WINDOW = unsafeWindow;
// dependencies to provide to each page script
const $ = WINDOW.jQuery;

/**
 * Currencies.
 * @typedef {Object} Currencies
 * @property {number} [keys] - Number of keys.
 * @property {number} [metal] - Amount of metal.
 */

/**
 * Utility functions
 * @namespace Utils
 */
const Utils = {
    /**
     * Get URL parameters
     * @returns {Object<string, string>} Object containing url parameters e.g. {'item': 'Fruit Shoot'}
     */
    getURLParams() {
        const params = {};
        const pattern = /[?&]+([^=&]+)=([^&]*)/gi;
        
        window.location.search.replace(pattern, (str, key, value) => {
            params[key] = decodeURIComponent(value);
        });
        
        return params;
    },
    /**
     * Omits keys with values that are empty from object.
     * @param {Object<string, *>} obj - Object to omit values from.
     * @returns {Object<string, *>} Object with null, undefined, or empty string values omitted.
     */
    omitEmpty(obj) {
        const result = {};
        
        for (let k in obj) {
            if (obj[k] != null && obj[k] !== '') {
                result[k] = obj[k];
            }
        }
        
        return result;
    },
    /**
     * Gets a list of IDs from a comma-seperated string.
     * @param {string} str - Comma-seperated string.
     * @returns {(string[]|null)} Array of id's if string is valid, null if not.
     */
    getIDsFromString(str) {
        if (/(\d+)(,\s*\d+)*/.test(str)) {
            return str.split(',');
        }
        
        return null;
    },
    /**
     * Executes hot key command
     * @param {Event} e - Event.
     * @param {Object} hotKeys - Hot keys mapped to functions.
     */
    execHotKey(e, hotKeys) {
        const isTextField = (
            /textarea|select/i.test(e.target.nodeName) || 
            ['number', 'text'].indexOf(e.target.type) !== -1
        );
        const code = e.keyCode || e.which;
        const method = hotKeys[code];
        
        if (!isTextField && method) {
            method();
        }
    },
    /**
     * Flattens an array.
     * @param {(*[] | *)[]} arr - Array to flatten.
     * @returns {*[]} Flattened array.
     */
    flatten(arrays) {
        return [].concat(...arrays);
    },
    /**
     * Partitions array based on conditions.
     * @template T
     * @param {T[]} arr - Array.
     * @param {function(T): boolean} method - Function to satisfy.
     * @returns {[T[], T[]]} Partitioned array.
     */
    partition(arr, fn) {
       let result = [[], []];
       
       for (let i = 0; i < arr.length; i++) {
           result[fn(arr[i]) ? 0 : 1].push(arr[i]);
       }
       
       return result;
    },
    /**
     * Groups an array by value from key.
     * @template T
     * @param {T[]} arr - Array.
     * @param {(string | function(T): (number | string))} key - Key to take value from.
     * @returns {Object<string, T[]>} Object of groups.
     */
    groupBy(arr, key) {
        return arr.reduce((a, b) => {
            (a[b[key]] = a[b[key]] || []).push(b);
            
            return a;
        }, {});
    },
    /**
     * Copies a value to clipboard.
     * @param {string} str - String to copy.
     */
    copyToClipboard(str) {
        const el = document.createElement('textarea');
        
        el.value = str;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
    },
    /**
     * Converts a currency string to a currency object.
     * @param {string} string - String to parse.
     * @returns {(Currencies|null)} Object of currencies if string is valid.
     */
    stringToCurrencies(string) {
        // mptf cross listing has no listing_price
        if (!string) {
            return null;
        }
        
        const prices = string.split(',');
        const currencies = {};
        
        for (let i = 0; i < prices.length; i++) {
            // match currencies - the first value is the amount
            // the second value is the currency name
            const match = prices[i].trim().match(/^([\d\.]*) (\w*)$/i);
            const value = parseFloat(match[1]);
            const currency = match[2].toLowerCase();
            
            if (isNaN(value)) {
                return null;
            }
            
            switch (currency) {
                case 'keys':
                case 'key':
                    currencies.keys = value;
                    break;
                case 'metal':
                case 'ref':
                    currencies.metal = value;
                    break;
            }
        }
        
        if (Object.keys(currencies).length === 0) {
            return null;
        }
        
        return currencies;
    }
};
// these are shared between page scripts
const shared = {
    // offers shared between offers pages
    offers: {
        // helpers for identifying items
        identifiers: {
            // checks if the item is a rare tf2 key
            isRareTF2Key(item) {
                const { appdata } = item;
                // array of rare TF2 keys (defindexes)
                const rare440Keys = [
                    '5049',
                    '5067',
                    '5072',
                    '5073',
                    '5079',
                    '5081',
                    '5628',
                    '5631',
                    '5632',
                    '5713',
                    '5716',
                    '5717',
                    '5762'
                ];
                const defindex = (
                    appdata &&
                    appdata.def_index
                );
                
                return Boolean(
                    typeof defindex === 'string' &&
                    rare440Keys.indexOf(defindex) !== -1
                );
            },
            // detects certain attributes from an item
            // this is used heavily and should be as optimized as possible
            getItemAttributes(item) {
                const hasDescriptions = typeof item.descriptions === 'object';
                const attributes = {
                    color: (item.name_color || '').toUpperCase()
                };
                const isUnique = attributes.color === '7D6D00';
                const { getEffectValue } = shared.offers.unusual;
                // is a strange quality item
                // thse are not marked as strange
                const isStrangeQuality = (attributes.color || '').toUpperCase() === 'CF6A32';
                const hasStrangeItemType = Boolean(
                    // the name must begin with strange
                    /^Strange /.test(item.market_hash_name) &&
                    // the item has a type
                    item.type &&
                    // the type matches a pattern similar to (Strange Hat - Points Scored: 0)
                    /^Strange ([0-9\w\s\\(\)'\-]+) \- ([0-9\w\s\(\)'-]+): (\d+)\n?$/.test(item.type)
                );
                const hasStatClock = (description) => {
                    return Boolean(
                        // has an orange color
                        (
                            description.color &&
                            description.color.toUpperCase() === 'CF6A32'
                        ) &&
                        // and matches this text
                        'Strange Stat Clock Attached' === description.value.trim()
                    );
                };
                const matchesLowcraft = (
                    item.name &&
                    item.name.match(/.* #(\d+)$/)
                );
                 
                // checks for a craft number that displays in game (<100) with regex and extracts it
                if (matchesLowcraft) {
                    attributes.lowcraft = parseInt(matchesLowcraft[1]);
                }
                
                // whether the item is strange or not (strange unusuals, strange genuine, etc.)
                // NOT strange quality items
                if (!isStrangeQuality && hasStrangeItemType) {
                    attributes.strange = true;
                }
                
                // no descriptions, so don't go any further
                if (!hasDescriptions) {
                    return attributes;
                }
                
                for (let i = 0; i < item.descriptions.length; i++) {
                    const description = item.descriptions[i];
                    const matchesEffect = (
                        attributes.effectName === undefined &&
                        // this will exclude cases with "Unusual Effect" descriptions
                        !isUnique &&
                        description.color === 'ffd700' &&
                        description.value.match(/^\u2605 Unusual Effect: (.+)$/)
                    );
                    const isSpelled = Boolean(
                        attributes.spelled === undefined &&
                        description.color === '7ea9d1' &&
                        description.value.indexOf('(spell only active during event)') !== -1
                    );
                    const isStrangePartAttached = Boolean(
                        attributes.parts === undefined &&
                        description.color === '756b5e' &&
                        description.value.match(/^\(?(.+?):\s*\d+\)?$/)
                    );
                    const isKillstreakAttached = Boolean(
                        attributes.killstreak === undefined &&
                        description.color === '7ea9d1' &&
                        description.value === 'Killstreaks Active'
                    );
                    const isUncraftable = Boolean(
                        !description.color &&
                        /^\( Not.* Usable in Crafting/.test(description.value)
                    );
                    
                    if (matchesEffect) {
                        const effectName = matchesEffect[1];
                        const value = getEffectValue(effectName);
                        
                        if (value) {
                            attributes.effect = value;
                        }
                    }
                    
                    if (isSpelled) {
                        attributes.spelled = true;
                    }
                        
                    if (isStrangePartAttached) {
                        attributes.parts = true;
                    }
                        
                    if (isKillstreakAttached) {
                        attributes.killstreak = true;
                    }
                    
                    if (isUncraftable) {
                        attributes.uncraft = true;
                    }
                    
                    // whether the item is strange or not (strange unusuals, strange genuine, etc.)
                    // NOT strange quality items
                    // this item is an item with a stat clock attached
                    if (!isStrangeQuality && hasStatClock(description)) {
                        attributes.strange = true;
                    }
                }
                
                return attributes;
            },
            // adds attributes to item element
            addAttributes(item, itemEl) {
                const {
                    getItemAttributes,
                    addAttributesToElement
                } = shared.offers.identifiers;
                const attributes = getItemAttributes(item);
                
                addAttributesToElement(itemEl, attributes);
            },
            // adds attributes to item element
            addAttributesToElement(itemEl, attributes) {
                // already checked
                if (itemEl.hasAttribute('data-checked')) {
                    return;
                }
                
                const {
                    getEffectURL
                } = shared.offers.unusual;
                const iconsEl = document.createElement('div');
                let craftNumberEl = null;
                const classes = [];
                
                if (attributes.effect) {
                    const url = getEffectURL(attributes.effect);
                    
                    itemEl.setAttribute('data-effect', attributes.effect);
                    itemEl.style.backgroundImage = `url('${url}')`;
                    classes.push('unusual');
                }
                
                if (attributes.strange) {
                    classes.push('strange');
                }
                
                if (attributes.uncraft) {
                    classes.push('uncraft');
                }
                
                if (attributes.lowcraft) {
                    // construct icon for lowcraft
                    const craftNumberEl = document.createElement('div');

                    craftNumberEl.textContent = `#${attributes.lowcraft}`;
                    craftNumberEl.classList.add('lowcraft');
                    craftNumberEl.style.color = `#${attributes.color}`;
                    
                    // add it to the icons element
                    itemEl.appendChild(craftNumberEl);
                }
                
                if (attributes.spelled) {
                    // construct icon for spells
                    const spellEl = document.createElement('img');
                    
                    spellEl.setAttribute('src', 'https://scrap.tf/img/spell.png');
                    spellEl.classList.add('spell');
                    
                    // add it to the icons element
                    iconsEl.appendChild(spellEl);
                }

                if (attributes.parts) {
                    // construct icon for strange parts
                    const partsEl = document.createElement('img');
                    
                    partsEl.setAttribute('src', 'https://tf2.kresenko.com/assets/wrench.png');
                    partsEl.classList.add('parts');
                    
                    // add it to the icons element
                    iconsEl.appendChild(partsEl);
                }

                if (attributes.killstreak) {
                    // construct icon for killstreak
                    const ksEl = document.createElement('img');
                    
                    ksEl.setAttribute('src', 'https://tf2.kresenko.com/assets/icon-ks.png');
                    ksEl.classList.add('ks');
                    
                    // add it to the icons element
                    iconsEl.appendChild(ksEl);
                }
                
                // check if we added any icons to the element holding icons
                if (iconsEl.children.length > 0) {
                    iconsEl.classList.add('icons');
                    
                    // then insert the element containing icons
                    itemEl.appendChild(iconsEl);
                }
                
                if (classes.length > 0) {
                    itemEl.classList.add(...classes);
                }
                
                itemEl.setAttribute('data-checked', 1);
            }
        },
        // unusual helper functions
        unusual: {
            effectsMap: {
                'Invalid Particle': 0,
                'Particle 1': 1,
                'Flying Bits': 2,
                'Nemesis Burst': 3,
                'Community Sparkle': 4,
                'Green Confetti': 6,
                'Purple Confetti': 7,
                'Haunted Ghosts': 8,
                'Green Energy': 9,
                'Purple Energy': 10,
                'Circling TF Logo': 11,
                'Massed Flies': 12,
                'Burning Flames': 13,
                'Scorching Flames': 14,
                'Searing Plasma': 15,
                'Vivid Plasma': 16,
                'Sunbeams': 17,
                'Circling Peace Sign': 18,
                'Circling Heart': 19,
                'Map Stamps': 20,
                'Genteel Smoke': 28,
                'Stormy Storm': 29,
                'Blizzardy Storm': 30,
                'Nuts n\' Bolts': 31,
                'Orbiting Planets': 32,
                'Orbiting Fire': 33,
                'Bubbling': 34,
                'Smoking': 35,
                'Steaming': 36,
                'Flaming Lantern': 37,
                'Cloudy Moon': 38,
                'Cauldron Bubbles': 39,
                'Eerie Orbiting Fire': 40,
                'Knifestorm': 43,
                'Misty Skull': 44,
                'Harvest Moon': 45,
                'It\'s a Secret to Everybody': 46,
                'Stormy 13th Hour': 47,
                'Kill-a-Watt': 56,
                'Terror-Watt': 57,
                'Cloud 9': 58,
                'Aces High': 59,
                'Dead Presidents': 60,
                'Miami Nights': 61,
                'Disco Beat Down': 62,
                'Phosphorous': 63,
                'Sulphurous': 64,
                'Memory Leak': 65,
                'Overclocked': 66,
                'Electrostatic': 67,
                'Power Surge': 68,
                'Anti-Freeze': 69,
                'Time Warp': 70,
                'Green Black Hole': 71,
                'Roboactive': 72,
                'Arcana': 73,
                'Spellbound': 74,
                'Chiroptera Venenata': 75,
                'Poisoned Shadows': 76,
                'Something Burning This Way Comes': 77,
                'Hellfire': 78,
                'Darkblaze': 79,
                'Demonflame': 80,
                'Bonzo the All-Gnawing': 81,
                'Amaranthine': 82,
                'Stare from Beyond': 83,
                'The Ooze': 84,
                'Ghastly Ghosts Jr': 85,
                'Haunted Phantasm Jr': 86,
                'Frostbite': 87,
                'Molten Mallard': 88,
                'Morning Glory': 89,
                'Death at Dusk': 90,
                'Abduction': 91,
                'Atomic': 92,
                'Subatomic': 93,
                'Electric Hat Protector': 94,
                'Magnetic Hat Protector': 95,
                'Voltaic Hat Protector': 96,
                'Galactic Codex': 97,
                'Ancient Codex': 98,
                'Nebula': 99,
                'Death by Disco': 100,
                'It\'s a Mystery to Everyone': 101,
                'It\'s a Puzzle to Me': 102,
                'Ether Trail': 103,
                'Nether Trail': 104,
                'Ancient Eldritch': 105,
                'Eldritch Flame': 106,
                'Neutron Star': 107,
                'Tesla Coil': 108,
                'Starstorm Insomnia': 109,
                'Starstorm Slumber': 110,
                'Brain Drain': 111,
                'Open Mind': 112,
                'Head of Steam': 113,
                'Galactic Gateway': 114,
                'The Eldritch Opening': 115,
                'The Dark Doorway': 116,
                'Ring of Fire': 117,
                'Vicious Circle': 118,
                'White Lightning': 119,
                'Omniscient Orb': 120,
                'Clairvoyance': 121,
                'Fifth Dimension': 122,
                'Vicious Vortex': 123,
                'Menacing Miasma': 124,
                'Abyssal Aura': 125,
                'Wicked Wood': 126,
                'Ghastly Grove': 127,
                'Mystical Medley': 128,
                'Ethereal Essence': 129,
                'Twisted Radiance': 130,
                'Violet Vortex': 131,
                'Verdant Vortex': 132,
                'Valiant Vortex': 133,
                'Sparkling Lights': 134,
                'Frozen Icefall': 135,
                'Fragmented Gluons': 136,
                'Fragmented Quarks': 137,
                'Fragmented Photons': 138,
                'Defragmenting Reality': 139,
                'Fragmenting Reality': 141,
                'Refragmenting Reality': 142,
                'Snowfallen': 143,
                'Snowblinded': 144,
                'Pyroland Daydream': 145,
                'Verdatica': 147,
                'Aromatica': 148,
                'Chromatica': 149,
                'Prismatica': 150,
                'Bee Swarm': 151,
                'Frisky Fireflies': 152,
                'Smoldering Spirits': 153,
                'Wandering Wisps': 154,
                'Kaleidoscope': 155,
                'Green Giggler': 156,
                'Laugh-O-Lantern': 157,
                'Plum Prankster': 158,
                'Pyroland Nightmare': 159,
                'Gravelly Ghoul': 160,
                'Vexed Volcanics': 161,
                'Gourdian Angel': 162,
                'Pumpkin Party': 163,
                'Frozen Fractals': 164,
                'Lavender Landfall': 165,
                'Special Snowfall': 166,
                'Divine Desire': 167,
                'Distant Dream': 168,
                'Violent Wintertide': 169,
                'Blighted Snowstorm': 170,
                'Pale Nimbus': 171,
                'Genus Plasmos': 172,
                'Serenus Lumen': 173,
                'Ventum Maris': 174,
                'Mirthful Mistletoe': 175,
                'Resonation': 177,
                'Aggradation': 178,
                'Lucidation': 179,
                'Stunning': 180,
                'Ardentum Saturnalis': 181,
                'Fragrancium Elementalis': 182,
                'Reverium Irregularis': 183,
                'Perennial Petals': 185,
                'Flavorsome Sunset': 186,
                'Raspberry Bloom': 187,
                'Iridescence': 188,
                'Tempered Thorns': 189,
                'Devilish Diablo': 190,
                'Severed Serration': 191,
                'Shrieking Shades': 192,
                'Restless Wraiths': 193,
                'Infernal Wraith': 195,
                'Phantom Crown': 196,
                'Ancient Specter': 197,
                'Viridescent Peeper': 198,
                'Eyes of Molten': 199,
                'Ominous Stare': 200,
                'Pumpkin Moon': 201,
                'Frantic Spooker': 202,
                'Frightened Poltergeist': 203,
                'Energetic Haunter': 204,
                'Smissmas Tree': 205,
                'Hospitable Festivity': 206,
                'Condescending Embrace': 207,
                'Sparkling Spruce': 209,
                'Glittering Juniper': 210,
                'Prismatic Pine': 211,
                'Spiraling Lights': 212,
                'Twisting Lights': 213,
                'Stardust Pathway': 214,
                'Flurry Rush': 215,
                'Spark of Smissmas': 216,
                'Polar Forecast': 218,
                'Shining Stag': 219,
                'Holiday Horns': 220,
                'Ardent Antlers': 221,
                'Festive Lights': 223,
                'Crustacean Sensation': 224,
                'Frosted Decadence': 226,
                'Sprinkled Delights': 228,
                'Terrestrial Favor': 229,
                'Tropical Thrill': 230,
                'Flourishing Passion': 231,
                'Dazzling Fireworks': 232,
                'Blazing Fireworks': 233,
                'Shimmering Fireworks': 234,
                'Twinkling Fireworks': 235,
                'Sparkling Fireworks': 236,
                'Glowing Fireworks': 237,
                'Glimmering Fireworks': 238,
                'Flying Lights': 239,
                'Limelight': 241,
                'Shining Star': 242,
                'Cold Cosmos': 243,
                'Refracting Fractals': 244,
                'Startrance': 245,
                'Starlush': 247,
                'Starfire': 248,
                'Stardust': 249,
                'Contagious Eruption': 250,
                'Daydream Eruption': 251,
                'Volcanic Eruption': 252,
                'Divine Sunlight': 253,
                'Audiophile': 254,
                'Soundwave': 255,
                'Synesthesia': 256,
                'Haunted Kraken': 257,
                'Eerie Kraken': 258,
                'Soulful Slice': 259,
                'Horsemann\'s Hack': 260,
                'Haunted Forever!': 261,
                'Forever and Forever!': 263,
                'Cursed Forever!': 264,
                'Moth Plague': 265,
                'Malevolent Monoculi': 266,
                'Haunted Wick': 267,
                'Wicked Wick': 269,
                'Spectral Wick': 270,
                'Musical Maelstrom': 271,
                'Verdant Virtuoso': 272,
                'Silver Serenade': 273,
                'Cosmic Constellations': 274,
                'Dazzling Constellations': 276,
                'Tainted Frost': 277,
                'Starlight Haze': 278,
                'Hard Carry': 279,
                'Jellyfish Field': 281,
                'Jellyfish Hunter': 283,
                'Jellyfish Jam': 284,
                'Global Clusters': 285,
                'Celestial Starburst': 286,
                'Sylicone Succiduous': 287,
                'Sakura Smoke Bomb': 288,
                'Treasure Trove': 289,
                'Bubble Breeze': 290,
                'Fireflies': 291,
                'Mountain Halo': 292,
                'Celestial Summit': 293,
                'Stellar Ascent': 294,
                'Sapped': 295,
                'Hellspawned Horns': 297,
                'Demonic Impaler': 299,
                'Revenant\'s Rack': 300,
                'Sixth Sense': 301,
                'Amygdala': 303,
                'The Bone Zone': 304,
                'Arachne\'s Web': 305,
                'Acidic Climate': 306,
                'Otherworldly Weather': 307,
                'Nightmarish Storm': 308,
                'Icestruck': 309,
                'Goldstruck': 311,
                'Radiant Rivalry': 312,
                'Radiant Legacy': 314,
                'Frosty Flavours': 315,
                'Mint Frost': 317,
                'North Star': 318,
                'Prettiest Star': 320,
                'Festive Falling Star': 321,
                'Lunar Lights': 322,
                'Fairy Lights': 324,
                'Natural Lights': 325,
                'Loyalist\'s Coronet': 327,
                'Knight\'s Prideful Spirit': 329,
                'Baron\'s Cherished Chaplet': 330,
                'Lure of the Deep': 331,
                'Violent Viridian': 333,
                'Magenta Monstrum': 334,
                'Rainbow Reverie': 335,
                'Cuban Smoke': 336,
                'Melting Mohawk': 337,
                'Scorched Scalp': 339,
                'Ignited Crest': 340,
                'Rare Shine': 341,
                'Distant Drift': 342,
                'Warp Drive': 344,
                'Overdrive': 345,
                'Butterfly Season': 346,
                'Psycho-delic': 348,
                'Bewitching Bugs': 349,
                'Spectral Fire': 350,
                'Galactic Flame': 351,
                'Revived Recharge': 352,
                'Undead Electricity': 353,
                'Frankencharged': 354,
                'Phantom Plague': 355,
                'Haunting Haze': 356,
                'Vicious Vampires': 357,
                'Ravenous Ravens': 358,
                'Delightful Doves': 359,
                'Searing Stove': 360,
                'Über Blaze': 362,
                'Sizzling': 364,
                'Crystal Crown': 365,
                'Halcyon Halo': 367,
                'Ghosts of Smissmas Time': 368,
                'Aurora Skies': 369,
                'Shining Bokeh': 370,
                'Playful Aurora': 371,
                'Frisky Morning': 372,
                'Hot': 701,
                'Isotope': 702,
                'Cool': 703,
                'Energy Orb': 704,
                'Showstopper': 3001,
                'Holy Grail': 3003,
                '\'72': 3004,
                'Fountain of Delight': 3005,
                'Screaming Tiger': 3006,
                'Skill Gotten Gains': 3007,
                'Midnight Whirlwind': 3008,
                'Silver Cyclone': 3009,
                'Mega Strike': 3010,
                'Haunted Phantasm': 3011,
                'Ghastly Ghosts': 3012,
                'Hellish Inferno': 3013,
                'Spectral Swirl': 3014,
                'Infernal Flames': 3015,
                'Infernal Smoke': 3016,
                'Acidic Bubbles of Envy': 3017,
                'Flammable Bubbles of Attraction': 3018,
                'Poisonous Bubbles of Regret': 3019,
                'Roaring Rockets': 3020,
                'Spooky Night': 3021,
                'Ominous Night': 3022,
                'Bewitched': 3023,
                'Accursed': 3024,
                'Enchanted': 3025,
                'Static Mist': 3026,
                'Eerie Lightning': 3027,
                'Terrifying Thunder': 3028,
                'Jarate Shock': 3029,
                'Nether Void': 3030,
                'Good-Hearted Goodies': 3031,
                'Wintery Wisp': 3032,
                'Arctic Aurora': 3033,
                'Winter Spirit': 3034,
                'Festive Spirit': 3035,
                'Magical Spirit': 3036,
                'Spectral Escort': 3037,
                'Astral Presence': 3038,
                'Arcane Assistance': 3039,
                'Emerald Allurement': 3041,
                'Pyrophoric Personality': 3042,
                'Spellbound Aspect': 3043,
                'Static Shock': 3044,
                'Veno Shock': 3045,
                'Toxic Terrors': 3046,
                'Arachnid Assault': 3047,
                'Creepy Crawlies': 3048,
                'Delightful Star': 3049,
                'Frosted Star': 3050,
                'Apotheosis': 3051,
                'Ascension': 3052,
                'Reindoonicorn Rancher': 3053,
                'Twinkling Lights': 3055,
                'Shimmering Lights': 3056,
                'Spectral Shackles': 3059,
                'Cursed Confinement': 3060,
                'Cavalier de Carte': 3061,
                'Hollow Flourish': 3063,
                'Magic Shuffle': 3064,
                'Vigorous Pulse': 3065,
                'Thundering Spirit': 3066,
                'Galvanic Defiance': 3067,
                'Wispy Halos': 3068,
                'Nether Wisps': 3069,
                'Aurora Borealis': 3070,
                'Aurora Australis': 3071,
                'Aurora Polaris': 3072,
                'Amethyst Winds': 3073,
                'Golden Gusts': 3074,
                'Smissmas Swirls': 3075,
                'Minty Cypress': 3077,
                'Pristine Pine': 3078,
                'Sparkly Spruce': 3079,
                'Festive Fever': 3081,
                'Golden Glimmer': 3083,
                'Frosty Silver': 3084,
                'Glamorous Dazzle': 3085,
                'Sublime Snowstorm': 3087,
                'Marigold Ritual': 3088,
                'Pungent Poison': 3090,
                'Blazed Brew': 3091,
                'Mysterious Mixture': 3092,
                'Linguistic Deviation': 3093,
                'Aurelian Seal': 3094,
                'Runic Imprisonment': 3095,
                'Prismatic Haze': 3097,
                'Rising Ritual': 3098,
                'Bloody Grip': 3100,
                'Toxic Grip': 3102,
                'Infernal Grip': 3103,
                'Death Grip': 3104,
                'Charged Arcane': 3105,
                'Thunderous Rage': 3106,
                'Convulsive Fiery': 3107,
                'Festivized Formation': 3108,
                'Twirling Spirits': 3110,
                'Squash n\' Twist': 3111,
                'Midnight Sparklers': 3112,
                'Boundless Blizzard': 3113,
                'Solar Scorched': 3114,
                'Deepsea Rave': 3115,
                'Blooming Beacon': 3117,
                'Beaming Beacon': 3118,
                'Blazing Beacon': 3119,
                'Floppin\' Frenzy': 3120,
                'Pastel Trance': 3121,
                'Wildflower Meadows': 3123,
                'Deep-sea Devourer': 3124,
                'Eldritch Horror': 3125,
                'Autumn Leaves': 3126,
                'Dead Man\'s Party': 3127,
                'Potion Explosion': 3128,
                'Haunted Cremation': 3129,
                'Cremation': 3130,
                'Snowfall': 3131,
                'Galactic Connection': 3132,
                'Dark Twilight': 3134,
                'Eldritch Rift': 3135,
                'Selfless Sensation': 3136,
                'Distant Desire': 3137,
                'Glamorous Glance': 3138,
                'Permafrost Essence': 3139,
                'Arctic Delight': 3141,
                'Winning Spirit': 3142,
                'Petal Prance': 3143,
                'Dragonflies\' Embrace': 3145,
                'Dragonflies\' Nature': 3147,
                'Dragonflies\' Lucent': 3148,
                'Electrocution': 3149,
                'Distress Signal': 3151,
                'Carioca\'s Call': 3153,
                'Fiesta Royale': 3154,
                'Grand Jubilee': 3156,
                'Elemental': 3157,
                'Godlike': 3159,
                'Teamwork Valorance': 3160,
                'Legacy Logo': 3162,
                'Desert Wind': 3163,
                'Monsoon Season': 3164,
                'Bountiful Riches': 3165,
                'Luxurious Lover': 3167,
                'Amatory': 3168,
                'Electrum': 3170,
                'Sakura Blessings': 3171,
                'Violent Violets': 3173,
                'Power Pressure': 3174,
                'Magnifying Momentum': 3176,
                'Charging Catalyst': 3177,
                'Amplifying Aura': 3178,
                'Mystic Fusion': 3179,
                'Obnoxious Confetti': 3180,
                'Lovable Confetti': 3181,
                'Confetti Celebration': 3182,
                'Heavy Rain': 3183,
                'Pumpkin Patch': 3184,
                'Snowy Day': 3185,
                'Snowy Spirit': 3186,
                'Lavender Sensation': 3188,
                'Verdant Phenomenon': 3189,
                'Award Winning': 3190,
                'Operatic Triumph': 3192,
                'Tangled Lights': 3193,
            },
            /**
             * Includes effect image in element.
             * @param {HTMLElement} itemEl - DOM element.
             * @param {Object} value - Value for Unusual effect.
             */
            modifyElement(itemEl, value) {
                const url = shared.offers.unusual.getEffectURL(value);
                
                itemEl.style.backgroundImage = `url('${url}')`;
                itemEl.classList.add('unusual');
            },
            /**
             * Gets the effect value from an effect name.
             * @param {string} effectName - Effect name.
             * @returns {string|undefined} Effect value, if available.
             */
            getEffectValue(effectName) {
                return shared.offers.unusual.effectsMap[effectName];
            },
            /**
             * Gets URL of image for effect.
             * @param {number} value - Value of effect.
             * @returns {string} URL string
             */
            getEffectURL(value) {
                return `https://tf2.kresenko.com/assets/particles/${value}_94x94.png`;
            }
        }
    }
};

/**
 * Adds attribute display properties to a list of hoverable items (e.g. in trade offers or steam profiles).
 * @param {NodeList|HTMLElement[]} itemsList - List of items to add attributes to.
 */
function addAttributesToHoverItems(itemsList) {
    if (itemsList.length === 0) {
        // nothing to do
        return;
    }
    
    const {
        getItemAttributes,
        addAttributesToElement
    } = shared.offers.identifiers;
    // cache for classinfo data
    const attributeCache = (function() {
        // the key to set/get values from
        const CACHE_INDEX = VERSION + '.getTradeOffers.cache';
        // this will hold our cached values
        let values = {};
        
        function save() {
            let value = JSON.stringify(values);
            
            if (value.length >= 50000) {
                // clear cache when it becomes too big
                values = {};
                value = '{}'; 
            }
            
            setStored(CACHE_INDEX, value);
        }
        
        // value is a hash of attributes
        // at the MOST, this will appear as:
        // {
        //     spelled: true,
        //     uncraft: true,
        //     strange: true,
        //     effect: 9
        // }
        function store(key, attributes) {
            values[key] = attributes;
        }
        
        function get() {
            values = JSON.parse(getStored(CACHE_INDEX) || '{}');
        }
        
        function key(itemEl) {
            const classinfo = itemEl.getAttribute('data-economy-item');
            const [ , , classid, instanceid] = classinfo.split('/');
            
            return [classid, instanceid].join(':');
        }
        
        function getValue(key) {
            return values[key];
        }
        
        return {
            save,
            get,
            store,
            key,
            getValue
        };
    }());
    let itemsChecked = 0;
    let cacheSaveTimer;
    
    // first load from cache
    attributeCache.get();
    
    Array.from(itemsList)
        // process unusual items first
        .sort((a, b) => {
            const getValue = (itemEl) => {
                const unusualBorderColor = 'rgb(134, 80, 172)';
                
                if (itemEl.style.borderColor === unusualBorderColor) {
                    return 1;
                }
                
                return -1;
            };
            
            return getValue(b) - getValue(a);
        })
        .forEach((itemEl) => {
            // get hover for item to get item information
            // this requires an ajax request
            // classinfo format - "classinfo/440/192234515/3041550843"
            const classinfo = itemEl.getAttribute('data-economy-item');
            const [ , appid, classid, instanceid] = classinfo.split('/');
            
            // only check tf2 items
            if (appid !== '440') {
                // continue
                return;
            }
            
            const cacheKey = attributeCache.key(itemEl);
            const cachedValue = attributeCache.getValue(cacheKey);
            
            if (cachedValue) {
                // use cached attributes
                addAttributesToElement(itemEl, cachedValue);
            } else {
                const itemStr = [appid, classid, instanceid].join('/');
                const uri = `economy/itemclasshover/${itemStr}?content_only=1&l=english`;
                const req = new WINDOW.CDelayedAJAXData(uri, 0);
                // this will space requests
                const delay = 5000 * Math.floor(itemsChecked / 50);
                
                itemsChecked++;
                
                setTimeout(() => {
                    // we use this to get class info (names, descriptions) for each item
                    // it would be much more efficient to use GetAssetClassInfo/v0001 but it requires an API key
                    // this may be considered later
                    req.RunWhenAJAXReady(() => {
                        // 3rd element is a script tag containing item data
                        const html = req.m_$Data[2].innerHTML;
                        // extract the json for item with pattern...
                        const match = html.match(/BuildHover\(\s*?\'economy_item_[A-z0-9]+\',\s*?(.*)\s\);/);
                        
                        try {
                            // then parse it
                            const item = JSON.parse(match[1]);
                            const attributes = getItemAttributes(item);
                            
                            // then add the attributes to the element
                            addAttributesToElement(itemEl, attributes);
                            
                            // store the attributes in cache
                            attributeCache.store(cacheKey, attributes);
                            
                            // then save it n ms after the last completed request
                            clearTimeout(cacheSaveTimer);
                            cacheSaveTimer = setTimeout(attributeCache.save, 1000);
                        } catch (e) {
                            
                        }
                    });
                }, delay);
            }
        });
}

// set a stored value
function setStored(name, value) {
    GM_setValue(name, value);
}

// get a stored value
function getStored(name) {
    return GM_getValue(name);
}

return {
    WINDOW,
    $,
    Utils,
    shared,
    addAttributesToHoverItems,
    setStored,
    getStored
};
