// @include /^https?:\/\/steamcommunity\.com\/tradeoffer.*/
function main({ WINDOW, $, Utils, shared, getStored, setStored }) {
    const urlParams = Utils.getURLParams();
    // these are never re-assigned in steam's source code
    // only updated
    const { UserYou, UserThem } = WINDOW;
    const STEAMID = UserYou.strSteamId;
    const PARTNER_STEAMID = UserThem.strSteamId;
    const INVENTORY = WINDOW.g_rgAppContextData;
    const PARTNER_INVENTORY = WINDOW.g_rgPartnerAppContextData;
    const TRADE_STATUS = WINDOW.g_rgCurrentTradeStatus;
    const page = {
        $document: $(document),
        $body: $('body'),
        $yourSlots: $('#your_slots'),
        $theirSlots: $('#their_slots'),
        $inventories: $('#inventories'),
        $inventoryBox: $('#inventory_box'),
        $inventoryDisplayControls: $('#inventory_displaycontrols'),
        $inventorySelectYour: $('#inventory_select_your_inventory'),
        $inventorySelectTheir: $('#inventory_select_their_inventory'),
        $tradeBoxContents: $('#inventory_box div.trade_box_contents'),
        $appSelectOption: $('.appselect_options .option'),
        // get jquery elements which are constantly changing based on page state
        get: {
            $inventory: () => $('.inventory_ctn:visible'),
            $activeInventoryTab: () => $('.inventory_user_tab.active'),
            $modifyTradeOffer: () => $('div.modify_trade_offer:visible'),
            $appSelectImg: () => $('#appselect_activeapp img'),
            $deadItem: () => $('a[href$="_undefined"]'),
            $changeOfferButton: () => $('#modify_trade_offer_opts div.content')
        }
    };
    // keys for stored values
    const stored = {
        id_visible: 'getTradeOfferWindow.id_visible'
    };
    /**
     * Interact with trade offer.
     */
    const tradeOfferWindow = (function() {
        /**
         * Get summary HTML.
         * @param {string} type - Name of user e.g. "Your" or "Their".
         * @param {NodeList} itemsList - List of item elements.
         * @param {boolean} isYou - Are these your items?
         * @param {Object} User - User object from Steam's JS that the items belong to.
         * @returns {string} Summary HTML.
         */
        function dumpSummary(type, itemsList, isYou, User) {
            /**
             * Summary of items in trade offer.
             * @typedef {Object} Summary
             * @property {number} total - Total number of items in summary.
             * @property {Object<string, string[]>} apps - Asset IDs by app ID.
             * @property {Object<string, number>} items - Number of each item. The key is a serialized string of item properties.
             */
            
            /**
             * Get summary of items.
             * @param {NodeList} itemsList - List of item elements.
             * @param {boolean} isYou - Are these your items?
             * @returns {(Summary|null)} Summary of items, null if inventory is not properly loaded.
             */
            function evaluateItems(itemsList, isYou) {
                const inventory = isYou ? INVENTORY : PARTNER_INVENTORY;
                const apps = {};
                const items = {};
                const total = itemsList.length;
                
                for (let i = 0; i < total; i++) {
                    const itemEl = itemsList[i];
                    // array containing item identifiers e.g. ['440', '2', '123']
                    const split = itemEl.getAttribute('id').replace(/^item/, '').split('_'); 
                    const [appid, contextid, assetid] = split;
                    // get the icon image
                    const img = itemEl.querySelector('img').getAttribute('src');
                    const borderColor = itemEl.style.borderColor;
                    const effect = itemEl.getAttribute('data-effect');
                    const uncraft = itemEl.classList.contains('uncraft');
                    const strange = itemEl.classList.contains('strange');
                    const item = (
                        inventory[appid] &&
                        inventory[appid].rgContexts[contextid].inventory.rgInventory[assetid]
                    );
                    
                    if (!item) {
                        // not properly loaded
                        return null;
                    }
                    
                    // create the key from the item properties
                    const key = attributesToString({
                        img,
                        borderColor,
                        effect,
                        uncraft,
                        strange
                    });
                    
                    items[key] = (items[key] || 0) + 1;
                    
                    if (apps[appid] === undefined) {
                        apps[appid] = [];
                    }
                    
                    apps[appid].push(assetid);
                }
                
                return {
                    total,
                    apps,
                    items
                };
            }
            
            /**
             * Attributes.
             * @typedef {Object} Attributes
             * @property {(string|undefined)} img - Image URL.
             * @property {(string|undefined)} borderColor - Border color.
             * @property {(string|undefined)} effect - Effect.
             * @property {boolean} uncraft - Is uncraftable?
             * @property {boolean} strange - Is strange?
             */
            
            /**
             * Serialize attributes to string.
             * @param {Attributes} attributes - Attributes.
             * @returns {string} Serialized attributes.
             */
            function attributesToString({
                img,
                borderColor,
                effect,
                uncraft,
                strange
            }) {
                return `${img || ''}\n${borderColor || ''}\n${effect || ''}\n${uncraft ? '1' : ''}\n${strange ? '1' : ''}`;
            }
            
            /**
             * Deserialize attributes from string.
             * @param {string} str - Serialized attributes.
             * @returns {Attributes} Deserialized attributes.
             */
            function attributesFromString(str) {
                const parts = str.split('\n');
                
                return {
                    img: parts[0] || undefined,
                    borderColor: parts[1] || undefined,
                    effect: parts[2] || undefined,
                    uncraft: parts[3] === '1',
                    strange: parts[4] === '1'
                };
            }
            
            /**
             * Gets the summary of items.
             * @param {Object<string, number>} items - Number of each item. The key is a serialized string of item properties.
             * @param {Object<string, string[]>} apps - Asset IDs by app ID.
             * @param {string} steamid - SteamID of user.
             * @returns {string} HTML string.
             */
            function getSummary(items, apps, steamid) {
                // helper for getting effect url
                const { getEffectURL } = shared.offers.unusual;
                const ids = apps['440'];
                let html = '';
                
                if (ids) {
                    // if tf2 items are in offer
                    // return summary items with backpack.tf link wrapped around 
                    const url = `https://backpack.tf/profiles/${steamid}?select=${ids.join(',')}`;
                    
                    html += `<a title="Open on backpack.tf" href="${url}" target="_blank">`;
                }
                
                for (let key in items) {
                    // generate the html for this item
                    const {
                        img,
                        borderColor,
                        effect,
                        uncraft,
                        strange
                    } = attributesFromString(key);
                    const count = items[key];
                    let backgroundImages = `url(${img})`;
                    let classes = 'summary_item';
                    
                    if (effect !== undefined && effect !== 'none') {
                        backgroundImages += `, url('${getEffectURL(effect)}')`;
                    }
                    
                    if (uncraft) {
                        classes += ' uncraft';
                    }
                    
                    if (strange) {
                        classes += ' strange';
                    }
                    
                    const styles = `background-image: ${backgroundImages}; border-color: ${borderColor};`;
                    const badge = count > 1 ? `<span class="summary_badge">${count}</span>` : '&nbsp;';
                    
                    // add the html for this item
                    html += `<span class="${classes}" style="${styles}">${badge}</span>`;
                }
                
                if (ids) {
                    // close the link
                    html += '</a>';
                }
                
                return html;
            }
            
            /**
             * Get header for summary.
             * @param {string} type - The name of trader e.g. "My" or "Them".
             * @param {number} total - Total number of items in offer.
             * @returns {string} HTML string.
             */
            function getHeader(type, total) {
                const itemsStr = total === 1 ? 'item' : 'items';
                
                return `<div class="summary_header">${type} summary (${total} ${itemsStr}):</div>`;
            }
            
            const summary = evaluateItems(itemsList, isYou);
            
            // no summary or no items
            if (summary === null || summary.total === 0) {
                return '';
            }
            
            // unpack summary...
            const { total, apps, items } = summary;
            const steamid = User.strSteamId;
            
            // return the header and summary
            const html = getHeader(type, total) + getSummary(items, apps, steamid);
            
            return html;
        }
        
        /**
         * Summarize a user's items in trade offer.
         * @param {boolean} isYou - Is this your summary?
         */
        function summarize(isYou) {
            const name = isYou ? 'My' : 'Their';
            const user = isYou ? UserYou : UserThem;
            const $slots = isYou ? page.$yourSlots : page.$theirSlots;
            const $container = isYou ? page.$yourSummary : page.$theirSummary;
            const itemsList = $slots.get(0).querySelectorAll('div.item');
            const html = dumpSummary(name, itemsList, isYou, user);
            
            $container.html(html);
        }
        
        /** 
         * Clears items that were added to the offer.
         */
        function clearItemsInOffer($addedItems) {
            const items = $addedItems.find('div.item').get();
            
            // remove all at once
            WINDOW.GTradeStateManager.RemoveItemsFromTrade(items.reverse());
        }
        
        /**
         * Add items to trade.
         * @param {HTMLElement[]} itemsList - List of items to add.
         */
        function addItemsByElements(itemsList) {
            if (WINDOW.Economy_UseResponsiveLayout() && WINDOW.ResponsiveTrade_SwitchMode) {
                WINDOW.ResponsiveTrade_SwitchMode(0);
            }
            
            const slotsCache = {};
            
            for (let i = 0; i < itemsList.length; i++) {
                const elItem = itemsList[i];
                
                if (WINDOW.BIsInTradeSlot(elItem)) {
                    // already in trade
                    continue;
                }
                
                const item = elItem.rgItem;
                
                // we don't want to touch it
                if (item.is_stackable) {
                    continue;
                }
                
                const xferAmount = 1;
                const is_currency = false;
                const { g_rgCurrentTradeStatus } = WINDOW;
                const userslots = item.is_their_item ? g_rgCurrentTradeStatus.them : g_rgCurrentTradeStatus.me;
                const slots = is_currency ? userslots.currency : userslots.assets;
                let bChanged = false;
                
                const slotsCacheKey = item.is_their_item ? 'them' : 'me';
                const slotsCacheCurrencyKey = is_currency ? 'currency' : 'asset';
                
                if (!slotsCache[slotsCacheKey]) {
                    slotsCache[slotsCacheKey] = {};
                }
                
                if (!slotsCache[slotsCacheKey][slotsCacheCurrencyKey]) {
                    // caching existing slots for faster lookup
                    slotsCache[slotsCacheKey][slotsCacheCurrencyKey] = slots
                        .reduce((accum, slot, i) => {
                            accum[slot.appid + '_' + slot.contextid + '_' + slot.id] = i;
                            return accum;
                        }, {});
                }
                
                // find existing element
                const key = item.appid + '_' + item.contextid + '_' + item.id;
                const iExistingElement = slotsCache[slotsCacheKey][slotsCacheCurrencyKey][key];
                
                if (iExistingElement !== undefined) {
                    if (slots[iExistingElement].amount !== xferAmount) {
                        slots[iExistingElement].amount = xferAmount;
                        bChanged = true;
                    }
                } else {
                    const oSlot = {
                        appid: item.appid,
                        contextid: item.contextid,
                        amount: xferAmount
                    };
                    
                    if (is_currency) {
                        oSlot.currencyid = item.id;
                    } else {
                        oSlot.assetid = item.id;
                    }
                    
                    slots.push(oSlot);
                    // update the cache
                    // maybe not entirely necessary
                    slotsCache[slotsCacheKey][slotsCacheCurrencyKey][key] = slots.length - 1;
                    bChanged = true;
                }
                
                if (!bChanged) {
                    continue;
                }
                
                WINDOW.GTradeStateManager.m_bChangesMade = true;
            }
            
            // update the trade status
            WINDOW.g_rgCurrentTradeStatus.version++;
            WINDOW.RefreshTradeStatus(WINDOW.g_rgCurrentTradeStatus);
        }
        
        /**
         * Clear items in offer.
         * @param {Object} $addedItems - JQuery object of items to remove.
         */
        function clear($addedItems) {
            clearItemsInOffer($addedItems);
        }
        
        /**
         * Update display of buttons.
         * @param {boolean} isYou - Is your inventory selected?
         * @param {(string|number)} appid - App ID of inventory selected.
         */
        function updateDisplay(isYou, appid) {
            // update the state of the button
            const updateState = ($btn, show) => {
                if (show) {
                    $btn.show();
                } else {
                    $btn.hide();
                }
            };
            const isTF2 = appid == 440;
            const isCSGO = appid == 730;
            const listingIntent = urlParams.listing_intent;
            // show keys button for tf2 and csgo
            const showKeys = isTF2 || isCSGO;
            const showMetal = isTF2;
            // 0 = buy order
            // 1 = sell order
            // we are buying, add items from our inventory
            const isBuying = Boolean(
                isYou &&
                listingIntent == 1
            );
            const isSelling = Boolean(
                !isYou &&
                listingIntent == 0
            );
            const showListingButton = Boolean(
                isTF2 &&
                (
                    isBuying ||
                    isSelling
                )
            );
            
            updateState(page.btns.$items, true); 
            updateState(page.btns.$keys, showKeys);
            updateState(page.btns.$metal, showMetal);
            updateState(page.btns.$listing, showListingButton);
        }
        
        /**
         * Call when a different user's inventory is selected.
         * @param {Object} $inventoryTab - JQuery element of inventory tab selected.
         */
        function userChanged($inventoryTab) {
            // fallback option for getting appid
            function appIdFallback() {
                // fallback to appid from image
                const src = page.get.$appSelectImg().attr('src') || '';
                const match = src.match(/public\/images\/apps\/(\d+)/);
                
                return match && match[1];
            }
            
            const $inventory = page.get.$inventory();
            const isYou = $inventoryTab.attr('id') === 'inventory_select_your_inventory';
            const match = $inventory.attr('id').match(/(\d+)_(\d+)$/);
            const appid = (match && match[1]) || appIdFallback();
            
            // now update the dispaly
            updateDisplay(isYou, appid);
        }
        
        return {
            summarize,
            addItemsByElements,
            clear,
            updateDisplay,
            userChanged
        };
    }());
    /**
     * Manage inventory load events.
     * @namespace inventoryManager
     */
    const inventoryManager = (function() {
        const inventories = {};
        const users = {};
        
        users[STEAMID] = [];
        users[PARTNER_STEAMID] = [];
        inventories[STEAMID] = {};
        inventories[PARTNER_STEAMID] = {};
        
        /**
         * An inventory has loaded, call all events according to parameters.
         * @param {string} steamid - Steamid of user.
         * @param {string} appid - Appid of inventory loaded.
         * @param {string} contextid - Contextid of inventory loaded.
         */
        function call(steamid, appid, contextid) {
            const actions = [
                ...users[steamid],
                ...((inventories[steamid][appid] && inventories[steamid][appid][contextid]) || [])
            ];
            
            // clear
            users[steamid] = [];
            inventories[steamid][appid] = [];
            // call all functions
            actions.forEach(fn => fn(steamid, appid, contextid));
        }
        
        /**
         * Registers an event.
         * @param {string} steamid - Steamid for user.
         * @param {string)} appid - Appid of event, or app-agnostic function to be called.
         * @param {string)} [contextid] - Contextid of app.
         * @param {function} [fn] - Function to call when inventory is loaded.
         */
        function register(steamid, appid, contextid, fn) {
            if (!fn) {
                fn = appid;
                users[steamid].push(fn);
            } else {
                if (!inventories[steamid][appid]) {
                    inventories[steamid][appid] = {};
                }
                
                if (!inventories[steamid][appid][contextid]) {
                    inventories[steamid][appid][contextid] = [];
                }
                
                inventories[steamid][appid][contextid].push(fn);
            }
        }
        
        /**
         * Registers an event.
         * @param {string} steamid - Steamid for user.
         * @param {function} [fn] - Function to call when inventory is loaded.
         */
        function registerForUser(steamid, fn) {
            users[steamid].push(fn);
        }
        
        return {
            register,
            registerForUser,
            call
        };
    }());
        
    /**
     * Result of getItems.
     * @typedef {Object} GetItemsResult
     * @property {HTMLElement[]} items - Items found.
     * @property {boolean} satisfied - Was the amount satisfied?
     */
    
    /**
     * Collect items based on conditions.
     * @param {string} mode - Mode e.g. 'ITEMS' to add items, 'KEYS' to add keys.
     * @param {number} amount - Amount of items to add.
     * @param {number} index - Index to start adding at.
     * @param {boolean} isYou - Are we adding from your inventory?
     * @returns {GetItemsResult} The items and whether the amount was satisfied.
     */
    const collectItems = (function() {
        // used for identifying items
        const identifiers = {
            // item is key
            isKey(item) {
                switch (parseInt(item.appid)) {
                    case 440:
                        return item.market_hash_name === 'Mann Co. Supply Crate Key';
                    case 730:
                        return identifiers.hasTag(item, 'Type', 'Key');
                }
                
                return null;
            },
            // item has tag
            hasTag(item, tagName, tagValue) {
                if (!item.tags) return null;
                
                const tags = item.tags;
                
                for (let i = 0, n = tags.length; i < n; i++) {
                    const tag = tags[i];
                    const hasTag = Boolean(
                        tag.category === tagName &&
                        tagValue === tag.name
                    );
                    
                    if (hasTag) {
                        return true;
                    }
                }
                
                return null;
            }
        };
        // used for finding items
        const finders = {
            metal(isYou, amount, index, name) {
                return pickItems(isYou, amount, index, (item) => {
                    return Boolean(
                        // the item is from tf2
                        item.appid == 440 &&
                        // the market hash name is the same as the name
                        item.market_hash_name === name
                    );
                });
            },
            // return items by array of id's
            id(ids) {
                const filter = (item) => {
                    return ids.indexOf(item.id) !== -1;
                };
                const items = pickItems(null, ids.length, 0, filter).sort((a, b) => {
                    return ids.indexOf(a.id) - ids.indexOf(b.id);
                });
                
                return items;
            }
        };
        
        /**
         * Pick items from inventory.
         * @param {(boolean|null)} isYou - Pick items from your inventory? null for both.
         * @param {number} amount - Amount of items to pick.
         * @param {number} index - Index to start picking items at.
         * @param {function(Object): boolean} filter - Filter method. Returns true to pick the item.
         * @returns {Object[]} Array of picked items from inventory. These are *not* elements.
         */
        function pickItems(isYou, amount, index, filter) {
            function getItems(isYou) {
                const $items = (isYou ? page.$yourSlots : page.$theirSlots).find('.item');
                const inventory = getInventory(appid, contextid, isYou);
                // get ids of items in trade offer matching app
                const addedIDs = $items.toArray().reduce((arr, el) => {
                    const item = el.rgItem;
                    const assetid = item.id;
                    
                    // appids could be string or number
                    if (item.appid == appid) {
                        arr.push(assetid);
                    }
                    
                    return arr;
                }, []);
                const ids = Object.keys(inventory);
                const total = [];
                let items = [];
                let currentIndex = 0;
                
                if (index < 0) {
                    // select in reverse
                    // since -1 is the starting position we add 1 to it before inverting it
                    index = (index + 1) * -1;
                    ids.reverse();
                }
                
                // items will always be sorted from front-to-back by default
                for (let i = 0; i < ids.length; i++) {
                    const id = ids[i];
                    const item = inventory[id];
                    
                    if (addedIDs.indexOf(id) !== -1) {
                        // id of item is already in trade offer
                        if (index !== 0 && filter(item)) {
                            currentIndex++; // increment if item matches
                        }
                        
                        continue;
                    } else if (items.length >= amount) {
                        // break when amount has been reached
                        break;
                    } else if (filter(item)) {
                        if (currentIndex >= index) {
                            items.push(item);
                        }
                        
                        // add items to total in case amount is not met
                        total.push(item);
                        currentIndex++;
                    }
                }
                
                if (items < amount) {
                    items = total.splice(offsetIndex(index, amount, total.length), amount);
                }
                
                return items;
            }
            
            const { appid, contextid } = getInventoryContext();
            
            // inventory must be present
            if (!appid) {
                return;
            }
            
            if (isYou === null) {
                // get items for both users
                return Utils.flatten([
                    true,
                    false
                ].map(getItems));
            }
            
            // get items for user based on whether 'isYou' is truthy or falsy
            return getItems(isYou);
        }
        
        /**
         * Offset index to pick items at based on amount and number of items available.
         * @param {number} index - Index.
         * @param {number} amount - Amount of items to pick.
         * @param {number} length - The total number of items available.
         * @returns {number} Modified index.
         */
        function offsetIndex(index, amount, length) {
            if (index < 0) {
                // pick from back if index is negative
                return Math.max(0, length - (amount + index + 1));
            }
            
            if (index + amount >= length) {
                // offset if index + amount is greater than the number of items we can pick
                return Math.max(0, length - amount);
            }
            
            // no offset needed
            return index; 
        }
        
        /**
         * Asset object.
         * @typedef {Object} Item
         * @property {string} appid - AppID of item.
         * @property {string} contextid - ContextID of item.
         * @property {string} id - ID of item.
         */
        
        /**
         * Get elements for items.
         * @param {Item[]} items - Items to get elements for.
         * @returns {HTMLElement[]} Elements for items.
         */
        function getElementsForItems(items) {
            return items
                .map((item) => {
                    // get element id for each item
                    const id = `item${item.appid}_${item.contextid}_${item.id}`;
                    
                    return document.getElementById(id);
                })
                .filter(el => el !== null);
        }
        
        /**
         * Pick metal from items based on value in refined metal.
         * @param {(boolean|null)} isYou - Pick items from your inventory? null for both.
         * @param {number} amount - Value to make in metal (e.g. 13.33).
         * @param {number} index - Index to add at.
         * @returns {GetItemsResult} The items and whether the amount was satisfied.
         */
        function getItemsForMetal(isYou, amount, index) {
            // converts a metal value to the equivalent number of scrap emtals
            // values are rounded
            function toScrap(num) {
                return Math.round(num / (1 / 9));
            }
            
            // value was met
            function valueMet() {
                return total === amount;
            }
            
            function getMetal(arr, type) {
                if (valueMet()) {
                    // empty array
                    return arr; 
                }
                
                // get number of metal to add based on how much more we need to add
                // as well as the value of the metal we are adding
                const curValue = values[type];
                const valueNeeded = amount - total;
                const amountToAdd = Math.floor(valueNeeded / curValue);
                // get array of metal
                const items = finder(isYou, amountToAdd, index, type); 
                const amountAdded = Math.min(
                    amountToAdd,
                    // there isn't quite enough there...
                    items.length
                ); 
                
                // add it to the total
                total = total + (amountAdded * curValue);
                
                // add the new items to the array
                return arr.concat(items);
            }
            
            // convert the amount to the number of scrap metal
            amount = toScrap(amount);
            
            // total to be added to
            let total = 0;
            const finder = finders.metal;
            // the value in scrap metal of each type of metal
            const values = {
                'Refined Metal': 9,
                'Reclaimed Metal': 3,
                'Scrap Metal': 1
            };
            const metal = Object.keys(values).reduce(getMetal, []);
            const items = getElementsForItems(metal);
            const satisfied = valueMet();
            
            return {
                items,
                satisfied
            };
        }
        
        /**
         * Collect items based on conditions.
         * @param {string} mode - Mode e.g. 'ITEMS' to add items, 'KEYS' to add keys.
         * @param {number} amount - Amount of items to add.
         * @param {number} index - Index to start adding at.
         * @param {(boolean|null)} isYou - Pick items from your inventory? null for both.
         * @returns {GetItemsResult} The items and whether the amount was satisfied.
         * @throws {Error} Unknown mode.
         */
        function getItems(mode, amount, index, isYou) {
            switch (mode) {
                // get keys
                case 'KEYS': {
                    const found = pickItems(isYou, amount, index, identifiers.isKey);
                    const items = getElementsForItems(found);
                    const satisfied = amount === items.length;
                    
                    return {
                        items,
                        satisfied
                    };
                }
                // get amount of metal (keys, ref, scrap);
                case 'METAL': {
                    const {
                        items,
                        satisfied
                    } = getItemsForMetal(isYou, amount, index);
                    
                    return {
                        items,
                        satisfied
                    };
                }
                // get items by id
                case 'ID': {
                    // list of id's is passed through index
                    const ids = index; 
                    const found = finders.id(ids);
                    const items = getElementsForItems(found);
                    const satisfied = ids.length === items.length;
                    
                    return {
                        items,
                        satisfied
                    };
                }
                // get items by whether they were recently obtained
                case 'RECENT': {
                    // gets nearest numbers to a given number within range of gap
                    const getNearNumbers = (nums, near, gap) => {
                        if (nums.length === 0) {
                            return [];
                        }
                        
                        const getDistance = (num) => Math.abs(num - near);
                        const sorted = nums
                            // add distance from "near" for each num
                            .map((num) => {
                                return {
                                    num,
                                    distance: getDistance(num)
                                };
                            })
                            .sort((a, b) => {
                                return a.distance - b.distance;
                            });
                        
                        // check if the nearest value is within the gap value
                        if (sorted[0].distance > gap) {
                            return [];
                        }
                        
                        // add the initial
                        const values = [sorted[0].num];
                        
                        // loop through sorted values
                        for (let i = 1; i < sorted.length; i++) {
                            const current = sorted[i];
                            const prev = sorted[i - 1];
                            const difference = Math.abs(prev.distance - current.distance);
                            
                            // gap is too big
                            if (difference > gap) {
                                // stop bleeding
                                return values;
                            }
                            
                            values.push(current.num);
                        }
                        
                        return values;
                    };
                    // check if an items is visible on page
                    // the item iteself will not contain the display property, but its parent does
                    const isVisible = (i, el) => {
                        return el.parentNode.style.display !== 'none';
                    };
                    // select all visible items from active inventory
                    let found = page.get.$inventory().find('div.item').filter(isVisible).toArray();
                    
                    // select in reverse
                    if (index < 0) {
                        index = (index + 1) * -1;
                        found = found.reverse();
                    }
                    
                    const $items = (isYou ? page.$yourSlots : page.$theirSlots).find('.item');
                    const getItemIdFromElement = (el) => el.id.split('_')[2];
                    // creates filter for whether the id is the given list
                    // setting "mustInclude" to true will filter so that "ids" must include the id
                    // setting "mustInclude" to false will filter so that "ids" must not include the id
                    const filterIds = (mustInclude, ids, processor) => {
                        const map = ids
                            .reduce((map, id) => {
                                map[id] = true;
                                
                                return map;
                            }, {});
                        
                        return function(value) {
                            // if a processor was provided it will process the value to convert it into an id
                            // e.g. getting the id from an html element
                            const id = processor ? processor(value) : value;
                            const hasId = Boolean(map[id]);
                            
                            // check whether this has or does not have the id
                            return mustInclude === hasId;
                        };
                    };
                    const { appid } = getInventoryContext(isYou);
                    // get ids of items in trade offer matching app
                    const addedIDs = $items.toArray()
                        .reduce((arr, el) => {
                            const rgItem = el.rgItem;
                            const assetid = rgItem.id;
                            
                            // appids could be string or number
                            if (rgItem.appid == appid) {
                                arr.push(assetid);
                            }
                            
                            return arr;
                        }, []);
                    const ids = found
                        // get ids as integers
                        .map((el) => parseInt(getItemIdFromElement(el)))
                        // filter out ids that are already added in the offer
                        .filter(filterIds(false, addedIDs));
                    const highestId = Math.max(0, ...ids);
                    const nearIds = getNearNumbers(ids, highestId, 100)
                        .map(id => id.toString());
                    const items = found
                        // filter elements to only this set of ids
                        .filter(filterIds(true, nearIds, getItemIdFromElement));
                    const satisfied = nearIds.length === items.length;
                    
                    return {
                        items,
                        satisfied
                    };
                }
                // get items displayed in the inventory
                case 'ITEMS': {
                    // check if an items is visible on page
                    // the item iteself will not contain the display property, but its parent does
                    function isVisible(_i, el) {
                        return el.parentNode.style.display !== 'none';
                    }
                    
                    // select all visible items from active inventory
                    let found = page.get.$inventory().find('div.item').filter(isVisible).toArray();
                    
                    // select in reverse
                    if (index < 0) {
                        index = (index + 1) * -1;
                        found = found.reverse();
                    }
                    
                    const offset = offsetIndex(index, amount, found.length);
                    const items = found.splice(offset, amount);
                    const satisfied = amount === items.length;
                    
                    return {
                        items,
                        satisfied
                    };
                }
                default:
                    throw new Error(`Unknown mode: ${mode}`);
            }
        }
        
        return getItems;
    }());
    
    /**
     * Gets the inventory for selected app and context of user.
     * @param {string} appid - AppID of inventory.
     * @param {string} contextid - ContextID of inventory.
     * @param {(boolean|null)} isYou - Is this your inventory?
     * @returns {Object} Inventory object.
     */
    function getInventory(appid, contextid, isYou) {
        const user = isYou ? UserYou : UserThem;
        
        return (
            user.rgAppInfo[appid] &&
            user.rgAppInfo[appid].rgContexts[contextid].inventory &&
            user.rgAppInfo[appid].rgContexts[contextid].inventory.rgInventory
        ) || {};
    }
    
    /**
     * An inventory context.
     * @typedef {Object} InventoryContext
     * @property {string} [appid] - AppID of inventory.
     * @property {string} [contextid] - ContextID of inventory.
     */
    
    /**
     * Gets the app of the currently visible inventory.
     * @returns {InventoryContext} AppID and ContextID of inventory.
     */
    function getInventoryContext() {
        const $inventory = page.get.$inventory();
        const match = ($inventory.attr('id') || '').match(/(\d+)_(\d+)$/);
        const [ , appid, contextid] = (match || []);
        
        return {
            appid,
            contextid
        };
    }
    
    /**
     * Adds display attributes (particles, strange border, etc.) to items.
     */
    function customizeItems(inventory) {
        const { addAttributes } = shared.offers.identifiers;
        
        for (let assetid in inventory) {
            const item = inventory[assetid];
            
            if (item.element) {
                // add the attributes to this element
                addAttributes(item, item.element);
            }
        }
    }
    
    // perform actions
    // add elements to page
    {
        const $tradeBox = page.$tradeBoxContents;
        // clearfix to add after inventories to fix height bug in firefox
        const $clear = $('<div style="clear: both"/>');
        
        // add summary and control HTML to the trade box
        $tradeBox.append(`
            <div id="controls">
                <div class="trade_rule selectableNone"/>
                <div class="selectableNone">Add multiple items:</div>
                <div class="filter_ctn">
                    <input id="amount_control" class="filter_search_box" type="number" min="0" step="any" placeholder="amount"/>
                    <input id="index_control" class="filter_search_box" type="number" min="0" placeholder="index"/>
                </div>
                <div id="add_btns" class="control_fields">
                    <div id="btn_additems" class="btn_black btn_small">
                        <span>Add</span>
                    </div>
                    <div id="btn_addkeys" class="btn_green btn_black btn_small">
                        <span>Add Keys</span>
                    </div>
                    <div id="btn_addmetal" class="btn_silver btn_black btn_small">
                        <span>Add Metal</span>
                    </div>
                    <div id="btn_addrecent" class="btn_silver btn_black btn_small">
                        <span>Add Recent</span>
                    </div>
                    <div id="btn_addlisting" class="btn_blue btn_black btn_small">
                        <span>Add Listing</span>
                    </div>
                </div>
                <div id="clear_btns" class="control_fields">
                    <div id="btn_clearmyitems" type="button" class="btn_black btn_small">
                        <span>Clear my items</span>
                    </div>
                    <div id="btn_cleartheiritems" type="button" class="btn_black btn_small">
                        <span>Clear their items</span>
                    </div>
                </div>
                <div id="id_fields" class="control_fields" style="display: none;">
                    <div class="filter_ctn">
                        <div class="filter_control_ctn">
                            <input id="ids_control" class="filter_search_box filter_full" type="text" placeholder="ids" autocomplete="off"/>
                        </div>
                        <div class="filter_tag_button_ctn filter_right_controls">
                            <div id="btn_addids" type="button" class="btn_black btn_small">
                                <span>Add</span>
                            </div>
                            <div id="btn_getids" type="button" class="btn_black btn_small">
                                <span>Get</span>
                            </div>
                        </div>
                        <div style="clear:both;"></div>
                    </div>
                </div>
            </div>  
            <div id="tradeoffer_items_summary">
                <div class="items_summary" id="your_summary"></div>
                <div class="items_summary" id="their_summary"></div>
            </div>
        `);
        
        // add the clear after inventories
        $clear.insertAfter(page.$inventories);
        
        // add newly created elements to page object
        page.$offerSummary = $('#tradeoffer_items_summary');
        page.$yourSummary = $('#your_summary');
        page.$theirSummary = $('#their_summary');
        page.$controls = $('#controls');
        page.controls = {
            $amount: $('#amount_control'),
            $index: $('#index_control'),
            $ids: $('#ids_control')
        };
        page.fields = {
            $ids: $('#id_fields'),
            $controls: $('#controls')
        };
        page.btns = {
            $clearMy: $('#btn_clearmyitems'),
            $clearTheir: $('#btn_cleartheiritems'),
            $items: $('#btn_additems'),
            $keys: $('#btn_addkeys'),
            $metal: $('#btn_addmetal'),
            $recent: $('#btn_addrecent'),
            $listing: $('#btn_addlisting'),
            $addIDs: $('#btn_addids'),
            $getIDs: $('#btn_getids')
        };
    }
    
    // binds events to elements
    {
        /**
         * The user changed from one app to another
         * @param {HTMLElement} appEl - App element.
         */
        function appChanged(appEl) {
            const id = appEl.getAttribute('id');
            const match = id.match(/appselect_option_(you|them)_(\d+)_(\d+)/);
            
            if (!match) {
                return;
            }
            
            const isYou = match[1] === 'you';
            const [ , , appid, _contextid] = match;
            
            tradeOfferWindow.updateDisplay(isYou, appid);
        }
        
        // add the listing price
        async function addListingPrice() {
            /**
             * Add currencies to the trade.
             * @param {(boolean|null)} isYou - Pick items from your inventory? null for both.
             * @param {Object} currencies - Object containing currencies.
             * @returns {Promise<string[]>} Array of reasons if value was not met for each currency.
             */
            async function addCurrencies(isYou, currencies) {
                const names = Object.keys(currencies).filter((currency) => {
                    return currencies[currency] > 0;
                });
                const index = parseInt(page.controls.$index.val()) || 0;
                const reasons = [];
                
                for (let i = 0; i < names.length; i++) {
                    const currency = names[i];
                    const amount = currencies[currency];
                    const satisfied = addItems(currency, amount, index, isYou);
                    
                    if (satisfied === false) {
                        reasons.push(`not enough ${currency.toLowerCase()}`);
                    }
                }
                
                return reasons;
            }
            
            // 0 = buy order
            // 1 = sell order
            const listingIntent = urlParams.listing_intent;
            // we are buying, add items from our inventory
            // listingIntent could be a string or number so == is used here
            const isYou = listingIntent == 1;
            const reasons = await addCurrencies(isYou, {
                KEYS: parseInt(urlParams.listing_currencies_keys) || 0,
                METAL: parseFloat(urlParams.listing_currencies_metal) || 0
            });
            
            if (reasons.length > 0) {
                // display message if any currencies were not met
                alert(`Listing value could not be met: ${reasons.join(' and ')}`);
            }
        }
        
        /**
         * Add items by list of IDs.
         * @param {string} idsStr - Comma-seperated list of IDs.
         */
        function addIDs(idsStr) {
            const ids = Utils.getIDsFromString(idsStr);
            
            if (ids === null) {
                return;
            }
            
            addItems('ID', 0, ids, null);
        }
        
        /**
         * Gets default values for adding items.
         * @returns {[number, number, boolean]} Default values for adding items.
         */
        function getDefaultsForAddItems() {
            return [
                // amount
                parseFloat(page.controls.$amount.val()) || 1,
                // index
                parseInt(page.controls.$index.val()) || 0,
                // your inventory is selected
                page.$inventorySelectYour.hasClass('active')
            ];
        }
        
        /**
         * Toggles the visibility of the ID fields.
         */
        function toggleIDFields() {
            const $controls = page.fields.$ids.toggle();
            const isVisible  = $controls.is(':visible') ? 1 : 0;
            
            setStored(stored.id_visible, isVisible);
        }
        
        /** 
         * Gets list of ids of items in trade offer.
         * @returns {string[]} List of IDs.
         */
        function getIDs() {
            const $inventoryTab = page.get.$activeInventoryTab();
            const isYou = $inventoryTab.attr('id') === 'inventory_select_your_inventory';
            const $slots = isYou ? page.$yourSlots : page.$theirSlots;
            const $items = $slots.find('div.item');
            
            return $items.toArray().map((el) => {
                const rgItem = el.rgItem;
                const assetid = rgItem.id;
                
                return assetid;
            });
        }
        
        /**
         * Handles key press events.
         * @param {Event} e - Key press event.
         */
        function keyPressed(e) {
            Utils.execHotKey(e, {
                // P
                112: toggleIDFields
            });
        }
        
        /**
         * Adds items to the trade offer.
         * @param {string} mode - Mode e.g. 'ITEMS' to add items, 'KEYS' to add keys.
         * @param {number} amount - Amount of items to add.
         * @param {number} index - Index to start adding at.
         * @param {boolean} isYou - Are we adding from your inventory?
         * @returns {(boolean|null)} Whether the amount was satisfied. Null if the offer cannot be modified.
         */
        function addItems(
            mode = 'ITEMS',
            amount = 1,
            index = 0,
            isYou = true
        ) {
            const canModify = Boolean(
                // an inventory is not selected
                (
                    (/(\d+)_(\d+)$/.test(page.get.$inventory().attr('id'))) ||
                    // the offer cannot be modified
                    page.get.$modifyTradeOffer().length === 0
                ) &&
                // the "Change offer" button is not visible
                !page.get.$changeOfferButton().is(':visible')
            );
            
            // we can modify the items in the offer based on the current window state
            if (canModify) {
                const {
                    items,
                    satisfied
                } = collectItems(
                    mode,
                    amount,
                    index,
                    isYou
                );
                
                // add items: 691.0009765625 ms
                // add items: 202.3779296875 ms
                // add  items: 178.66015625 ms
                tradeOfferWindow.addItemsByElements(items);
                
                return satisfied;
            }
            
            return null;
        }
        
        // app was changed
        page.$appSelectOption.on('click', (e) => {
            appChanged(e.target);
        });
        // user inventory was changed to your inventory
        page.$inventorySelectYour.on('click', () => {
            tradeOfferWindow.userChanged(page.$inventorySelectYour);
        });
        // user inventory was changed to their inventory
        page.$inventorySelectTheir.on('click', () => {
            tradeOfferWindow.userChanged(page.$inventorySelectTheir);
        });
        page.btns.$clearMy.on('click', () => {
            tradeOfferWindow.clear(page.$yourSlots);
        });
        page.btns.$clearTheir.on('click', () => {
            tradeOfferWindow.clear(page.$theirSlots);
        });
        page.btns.$items.on('click', () => {
            addItems('ITEMS', ...getDefaultsForAddItems());
        });
        page.btns.$keys.on('click', () => {
            addItems('KEYS', ...getDefaultsForAddItems());
        });
        page.btns.$metal.on('click', () => {
            addItems('METAL', ...getDefaultsForAddItems());
        });
        page.btns.$recent.on('click', () => {
            addItems('RECENT', ...getDefaultsForAddItems());
        });
        page.btns.$listing.on('click', () => {
            addListingPrice();
        });
        page.btns.$addIDs.on('click', () => {
            addIDs(page.controls.$ids.val());
        });
        page.btns.$getIDs.on('click', () => {
            page.controls.$ids.val(getIDs().join(','));
        });
        page.$document.on('keypress', (e) => {
            keyPressed(e);
        });
    }
    
    // register inventory events
    {
        // this will force an inventory to load
        function forceInventory(appid, contextid) {
            TRADE_STATUS.them.assets.push({
                appid: appid,
                contextid: contextid,
                assetid: '0',
                amount: 1
            });
            
            try {
                WINDOW.RefreshTradeStatus(TRADE_STATUS, true);
            } catch (e) {
                // ignore the error
            }
            
            TRADE_STATUS.them.assets = [];
            
            try {
                WINDOW.RefreshTradeStatus(TRADE_STATUS, true);
            } catch (e) {
                // ignore the error
            }
        }
        
        // customizes the elements in the inventory
        function customizeElements(steamid, appid, contextid) {
            const isYou = steamid === STEAMID;
            const inventory = isYou ? INVENTORY : PARTNER_INVENTORY;
            const contextInventory = inventory[appid].rgContexts[contextid].inventory.rgInventory;
            
            if (!isYou) {
                // force the items in their inventory to be displayed so we can add images
                // if their inventory has not been displayed
                forceVisibility();
            }
            
            customizeItems(contextInventory);
            // re-summarize
            tradeOfferWindow.summarize(isYou);
        }
        
        /**
         * Force visibility of other user's inventory.
         * @returns {undefined}
         */
        function forceVisibility() {
            const $activeTab = page.get.$activeInventoryTab();
            const $theirs = page.$inventorySelectTheir;
            
            $theirs.trigger('click');
            $activeTab.trigger('click');
        }
        
        inventoryManager.registerForUser(STEAMID, () => {
            // something to do when your inventory is loaded...
        });
        
        if (urlParams.listing_intent !== undefined) {
            // we are buying, add items from our inventory
            const isSelling = urlParams.listing_intent == 0;
            
            page.btns.$listing.addClass(isSelling ? 'selling' : 'buying');
            
            // force their inventory to load if we are selling
            if (isSelling) {
                forceInventory('440', '2');
            }
        }
        
        if (urlParams.for_item !== undefined) {
            const [appid, contextid, assetid] = urlParams.for_item.split('_');
            const item = {
                appid,
                contextid,
                assetid,
                amount: 1
            };
            
            TRADE_STATUS.them.assets.push(item);
            WINDOW.RefreshTradeStatus(TRADE_STATUS, true);
            
            // check for a dead item when this inventory is loaded
            inventoryManager.register(PARTNER_STEAMID, appid, contextid, () => {
                if (page.get.$deadItem().length === 0) {
                    return;
                }
                
                TRADE_STATUS.them.assets = [];
                WINDOW.RefreshTradeStatus(TRADE_STATUS, true);
                alert(
                    `Seems like the item you are looking to buy (ID: ${assetid}) is no longer available. ` +
                    'You should check other user\'s backpack and see if it\'s still there.'
                );
            });
        }
        
        [STEAMID, PARTNER_STEAMID].forEach((steamid) => {
            inventoryManager.register(steamid, '440', '2', customizeElements);
        });
    }
    
    // observe changes to dom
    {
        // observe changes to trade slots
        {
            /**
             * Observe changes to slots.
             * @param {HTMLElement} slotsEl - Slots element.
             * @param {boolean} isYou - Is this your inventory?
             */
            function observeSlots(slotsEl, isYou) {
                // summarizes the trade offer
                function summarize() {
                    tradeOfferWindow.summarize(isYou);
                    lastSummarized = new Date(); // add date
                }
                
                const observer = new MutationObserver(() => {
                    const canInstantSummarize = Boolean(
                        !lastSummarized ||
                        // compare with date when last summarized
                        new Date() - lastSummarized > 200  ||
                        // large summaries take longer to build and can hurt performance
                        slotsEl.children.length <= 204
                    );
                    const interval = canInstantSummarize ? 10 : 200;
                    
                    // we use a timer so that if multiple dom insertions occur at the same time this will only run once
                    clearTimeout(timer);
                    timer = setTimeout(summarize, interval);
                });
                let lastSummarized = new Date();
                let timer;
                
                observer.observe(slotsEl, {
                    childList: true,
                    characterData: false,
                    subtree: true
                });
            }
            
            observeSlots(page.$yourSlots[0], true);
            observeSlots(page.$theirSlots[0], false);
        }
        
        // observe inventory changes
        {
            const observer = new MutationObserver((mutations) => {
                if (!mutations[0].addedNodes) return;
                
                const mutation = mutations[0];
                const inventory = mutation.addedNodes[0];
                const split = inventory.id.replace('inventory_', '').split('_');
                const [steamid, appid, contextid] = split;
                
                inventoryManager.call(steamid, appid, contextid);
            });
            
            observer.observe(page.$inventories[0], {
                childList: true,
                characterData: false,
                subtree: false
            });
        }
    }
    
    // configure state
    {
        tradeOfferWindow.updateDisplay(true, 440); // this works
        
        if (getStored(stored.id_visible) == 1) {
            page.fields.$ids.show();
        }
        
        if (urlParams.listing_intent !== undefined) {
            const isSelling = urlParams.listing_intent == 0;
            
            page.btns.$listing.addClass(isSelling ? 'selling' : 'buying');
        }
    }
    
    // override page functions
    {
        // hides an element
        function hideElement(el) {
            el.style.display = 'none';
        }
        
        // shows an element
        function showElement(el) {
            el.style.display = '';
        }
        
        // This is a very slow function when many items are involved, most of the function isn't changed.
        // Performance of this function was improved by around 2x
        WINDOW.UpdateSlots = function( rgSlotItems, rgCurrency, bYourSlots, user, version ) {
            const { $ } = WINDOW;
            // const elSlotContainer = bYourSlots ? $('your_slots') : $('their_slots');
            const slotContainerEl = bYourSlots ? document.getElementById('your_slots') : document.getElementById('their_slots');
            const elCurrencySlotContainer = bYourSlots ? $('your_slots_currency') : $('their_slots_currency');
            
            // see what the last slot with an item is
            let cMaxSlotId = 0;
            
            if ( rgSlotItems instanceof Array ) {
                cMaxSlotId = rgSlotItems.length;
            } else {
                for ( let slotid in rgSlotItems ) {
                    let iSlot = parseInt( slotid );
                    
                    if ( iSlot && !isNaN( iSlot ) ) {
                        cMaxSlotId = Math.max( iSlot, cMaxSlotId );
                    }
                }
                
                cMaxSlotId++;
            }
            
            let cCurrenciesInTrade = 0;
            
            for ( let iCurrency = 0; iCurrency < rgCurrency.length; iCurrency++ ) {
                const currencyUpdate = rgCurrency[iCurrency];
                // just skip pending inventories, the currency will be drawn after the inventory arrival
                const inventory = user.getInventory( currencyUpdate.appid, currencyUpdate.contextid );
                
                if ( !inventory || inventory.BIsPendingInventory() ) {
                    continue;
                }
                
                cCurrenciesInTrade++;
                
                const currency = user.FindCurrency( currencyUpdate.appid, currencyUpdate.contextid, currencyUpdate.currencyid );
                const stack = WINDOW.GetTradeItemStack( user, currency );
                
                if ( ( parseInt( stack.amount ) + parseInt( stack.fee ) ) != currencyUpdate.amount ) {
                    WINDOW.UpdateTradeItemStackDisplay( currency, stack, currencyUpdate.amount );
                    
                    if ( !bYourSlots && !WINDOW.g_bTradeOffer ) {
                        WINDOW.HighlightNewlyAddedItem( stack.element );
                    }
                }
                
                stack.version = version;
            }
            
            const rgCurrencySlots = elCurrencySlotContainer.children;
            
            if ( cCurrenciesInTrade < rgCurrencySlots.length ) {
                // there's an extra slot in the trade, remove it
                for ( let iCurrencySlot = 0; iCurrencySlot < rgCurrencySlots.length; iCurrencySlot++ ) {
                    const elSlot = rgCurrencySlots[iCurrencySlot];
                    const stack = elSlot.stack;
                    
                    if ( stack.version < version ) {
                        elSlot.remove();
                        
                        const origCurrency = user.FindCurrency( stack.appid, stack.contextid, stack.id );
                        
                        origCurrency.amount = origCurrency.original_amount;
                        origCurrency.trade_stack = null;
                        
                        if ( bYourSlots ) {
                            WINDOW.UpdateCurrencyDisplay( origCurrency );
                        }
                    }
                }
            }
            
            WINDOW.EnsureSufficientTradeSlots( bYourSlots, cMaxSlotId, cCurrenciesInTrade );
            
            let nNumBadItems = 0;
            let firstBadItem = null;
            let nNumExpiringItems = 0;
            let firstExpiringItem = null;
            let nFullInventoryAppId = false;
            
            const slotsList = slotContainerEl.children;
            
            // this is where the majority of the time is spent
            // 348.0029296875 ms
            // 251.383056640625 ms
            // 178.10400390625 ms
            for ( let slot = 0; slot < slotsList.length; slot++ ) {
                // simply taking from an array rather than querying each slot cuts the time by about 1/3
                const elSlot = slotsList[slot];
                // elCurItem.rgItem is available using querySelector
                const elCurItem = elSlot.querySelector('.item');
                let elNewItem = null;
                let bRemoveCurItem = elCurItem != null;
                // lets us know if we need to indicate this item was added
                let bItemIsNewToTrade = false; 
                // if a stackable item's amount has changed, we also treat that like new
                let bStackAmountChanged = false;
                
                if ( rgSlotItems[slot] ) {
                    const {
                        appid,
                        contextid,
                        assetid,
                        amount
                    } = rgSlotItems[slot];
                    
                    // check that we are allowed to receive this item
                    if ( !bYourSlots ) {
                        if ( !UserYou.BAllowedToRecieveItems( appid, contextid ) ) {
                            if ( !nFullInventoryAppId && UserYou.BInventoryIsFull( appid, contextid ) ) {
                                nFullInventoryAppId = appid;
                            }
                            
                            if ( nNumBadItems == 0 ) {
                                firstBadItem = rgSlotItems[slot];
                            }
                            
                            nNumBadItems++;
                        }
                    }
                    
                    // this doesn't do any DOM querying
                    const elItem = user.findAssetElement( appid, contextid, assetid );
                    
                    if (
                        g_dateEscrowEnd != null &&
                        elItem.rgItem &&
                        typeof elItem.rgItem.item_expiration == 'string'
                    ) {
                        const dateExpiration = new Date( elItem.rgItem.item_expiration );
                        
                        if ( g_dateEscrowEnd >= dateExpiration ) {
                            if ( nNumExpiringItems == 0 ) {
                                firstExpiringItem = rgSlotItems[slot];
                            }
                            
                            nNumExpiringItems++;
                        }
                    }
                    
                    if (
                        elCurItem &&
                        elCurItem.rgItem &&
                        elCurItem.rgItem.appid == appid &&
                        elCurItem.rgItem.contextid == contextid &&
                        elCurItem.rgItem.id == assetid &&
                        !elCurItem.rgItem.unknown
                    ) {
                        // it's already there
                        bRemoveCurItem = false;
                        
                        if ( elCurItem.rgItem.is_stackable ) {
                            const stack = elCurItem.rgItem;
                            
                            bStackAmountChanged = ( amount != stack.amount );
                            WINDOW.UpdateTradeItemStackDisplay( stack.parent_item, stack, amount );
                        }
                    } else {
                        // it's new to the trade
                        elNewItem = elItem;
                        
                        const item = elNewItem.rgItem;
                        
                        if ( !item.unknown ) {
                            bItemIsNewToTrade = true;
                        }
                        
                        if ( item.is_stackable ) {
                            const stack = WINDOW.GetTradeItemStack( user, item );
                            
                            bStackAmountChanged = ( amount != stack.amount );
                            WINDOW.UpdateTradeItemStackDisplay( item, stack, amount );
                            
                            elNewItem = stack.element;
                        }
                        
                        if ( elNewItem && elNewItem.parentNode ) {
                            const slotActionMenuButtonEl = elNewItem.parentNode.querySelector('.slot_actionmenu_button');
                            
                            if ( slotActionMenuButtonEl ) {
                                // hide the button
                                // on steam's end this would normally be called with .hide()
                                // but that's not available with vanilla methods
                                hideElement(slotActionMenuButtonEl);
                            }
                            
                            if ( WINDOW.BIsInTradeSlot( elNewItem ) ) {
                                // this is called when a slot is cleared
                                // all subsequent slots are also cleared to move items up 
                                WINDOW.CleanupSlot( elNewItem.parentNode.parentNode );
                                bItemIsNewToTrade = false;
                            }
                            
                            // remove element from its current location
                            elNewItem.remove();
                        }
                    }
                }
                
                if ( elCurItem && bRemoveCurItem ) {
                    // this block isn't usually reached from my experience
                    
                    if ( elCurItem.rgItem && elCurItem.rgItem.is_stackable ) {
                        const stack = elCurItem.rgItem;
                        
                        WINDOW.UpdateTradeItemStackDisplay( stack.parent_item, stack, 0 );
                        elCurItem.remove();
                    } else if ( elCurItem.rgItem && elCurItem.rgItem.homeElement ) {
                        elCurItem.rgItem.homeElement.appendChild( elCurItem.remove() );
                    } else {
                        elCurItem.remove();
                    }
                    
                    WINDOW.CleanupSlot( elSlot );
                }
                
                if ( elNewItem ) {
                    // this is called when an item is added to a slot
                    WINDOW.PutItemInSlot( elNewItem, elSlot );
                    
                    if ( bItemIsNewToTrade && !bYourSlots && !WINDOW.g_bTradeOffer ) {
                        WINDOW.HighlightNewlyAddedItem( elNewItem );
                    }
                } else if ( bStackAmountChanged && !bYourSlots && !WINDOW.g_bTradeOffer ) {
                    WINDOW.HighlightNewlyAddedItem( elCurItem );
                }
            }
            
            if (
                !bYourSlots &&
                nNumBadItems != g_nItemsFromContextWithNoPermissionToReceive &&
                !UserThem.BIsLoadingInventoryData()
            )  {
                g_nItemsFromContextWithNoPermissionToReceive = nNumBadItems;
                
                if ( nNumBadItems > 0 ) {
                    let strEvent = "";
                    const item = user.findAsset( firstBadItem.appid, firstBadItem.contextid, firstBadItem.assetid );
                    
                    if ( item ) {
                        // escapeHTML isn't a native method and I'm unsure if this will be pulled in from the scope
                        // so we check if it exists before calling it
                        const name = item.name.escapeHTML ? item.name.escapeHTML() : item.name;
                        
                        if ( nNumBadItems == 1 ) {
                            strEvent = 'You are not allowed to receive the item "%1$s."'
                                .replace( '%1$s', name );
                        } else {
                            strEvent = 'You are not allowed to receive %1$s of the items being offered including "%2$s."'
                                .replace( '%1$s', nNumBadItems )
                                .replace( '%2$s', name );
                        }
                    } else {
                        if ( nNumBadItems == 1 ) {
                            strEvent = 'You are not allowed to receive one of the items being offered.';
                        } else {
                            strEvent = 'You are not allowed to receive %1$s of the items being offered.'
                                .replace( '%1$s', nNumBadItems );
                        }
                    }
                    
                    if ( nFullInventoryAppId ) {
                        const name = rgAppData.name.escapeHTML ? rgAppData.name.escapeHTML() : rgAppData.name;
                        const rgAppData = g_rgAppContextData[nFullInventoryAppId];
                        const strEventAppend = 'Your inventory for %1$s is full.'
                            .replace( '%1$s', name );
                        
                        strEvent = strEvent + ' ' + strEventAppend;
                    }
                    
                    const elEvent = new WINDOW.Element( 'div', {'class': 'logevent' } );
                    elEvent.update( strEvent );
                    $('log').appendChild( elEvent );
                }
            }
            
            if ( nNumExpiringItems != WINDOW.g_rgnItemsExpiringBeforeEscrow[bYourSlots ? 0 : 1] ) {
                WINDOW.g_rgnItemsExpiringBeforeEscrow[bYourSlots ? 0 : 1] = nNumExpiringItems;
                
                if ( nNumExpiringItems > 0 ) {
                    let strEvent = "";
                    const item = user.findAsset( firstExpiringItem.appid, firstExpiringItem.contextid, firstExpiringItem.assetid );
                    
                    if ( item ) {
                        const name = item.name.escapeHTML ? item.name.escapeHTML() : item.name;
                        
                        if ( nNumExpiringItems == 1 ) {
                            strEvent = 'The item "%1$s" cannot be included in this trade because it will expire before the trade hold period is over.'
                                .replace( '%1$s', name );
                        } else {
                            strEvent = 'Some items, including "%1$s," cannot be included in this trade because they will expire before the trade hold period is over.'
                                .replace( '%1$s', name );
                        }
                    } else {
                        if ( nNumExpiringItems == 1 ) {
                            strEvent = 'One item cannot be included in this trade because it will expire before the trade hold period is over.';
                        } else {
                            strEvent = 'Some items cannot be included in this trade because they will expire before the trade hold period is over.';
                        }
                    }
                    
                    const elEvent = new WINDOW.Element( 'div', {'class': 'logevent' } );
                    elEvent.update( strEvent );
                    $('log').appendChild( elEvent );
                }
            }
        };
        
        // This is one of the hottest functions in UpdateSlots
        // There were some inefficient queries in the original function
        WINDOW.PutItemInSlot = function( elItem, elSlot ) {
            const item = elItem.rgItem;
            
            if (
                elItem.parentNode &&
                elItem.parentNode.nodeType != Node.DOCUMENT_FRAGMENT_NODE /* IE cruft */
            ) {
                hideElement(elItem.parentNode.querySelector('.slot_actionmenu_button'));
                elItem.remove();
            }
            
            elSlot.querySelector('.slot_inner').appendChild( elItem );
            
            if ( item && item.appid && WINDOW.g_rgAppContextData[item.appid] ) {
                const rgAppData = WINDOW.g_rgAppContextData[item.appid];
                const slotAppLogo = elSlot.querySelector('.slot_applogo');
                
                slotAppLogo.querySelector('img').src = rgAppData.icon;
                showElement(slotAppLogo);
                
                if (
                    typeof(WINDOW.g_rgPlayedApps) != 'undefined' &&
                    WINDOW.g_rgPlayedApps !== false &&
                    !WINDOW.g_rgPlayedApps[item.appid]
                )  {
                    const strWarning = 'You\'ve never played the game this item is from.';
                    
                    if ( !item.fraudwarnings ) {
                        item.fraudwarnings = [ strWarning ];
                    } else {
                        // Don't push the NoPlaytime warning over and over.
                        if ( item.fraudwarnings.indexOf( strWarning ) == -1 ) {
                            item.fraudwarnings.push( strWarning );
                        }
                    }
                }
                
                if ( item.id && item.fraudwarnings ) {
                    showElement(elSlot.querySelector('.slot_app_fraudwarning'));
                } else  {
                    hideElement(elSlot.querySelector('.slot_app_fraudwarning'));
                }
            } else {
                hideElement(elSlot.querySelector('.slot_applogo'));
                hideElement(elSlot.querySelector('.slot_app_fraudwarning'));
            }
            
            const elActionMenuButton = elSlot.querySelector('.slot_actionmenu_button');
            
            showElement(elActionMenuButton);
            
            // WINDOW.jQuery('#' + elActionMenuButton.id).click(() => {
            //     HandleTradeActionMenu( elActionMenuButton, item, item.is_their_item ? UserThem : UserYou )
            // } );
            elActionMenuButton.addEventListener('click', (_e) => {
                HandleTradeActionMenu( elActionMenuButton, item, item.is_their_item ? UserThem : UserYou )
            });
            
            // WINDOW.jQuery(elSlot).addClass('has_item');
            elSlot.classList.add('has_item');
            elSlot.hasItem = true;
        };
        
        // basically removes animation due to bugginess
        // also it's a bit faster
        WINDOW.EnsureSufficientTradeSlots = function(bYourSlots, cSlotsInUse, cCurrencySlotsInUse) {
            // stand-alone function to create a slot element
            function createTradeSlotElement(bIsYourSlot, iSlot) {
                const id = bIsYourSlot ? 'your_slot_' + iSlot : 'their_slot_' + iSlot;
                const elSlot = WINDOW.CreateSlotElement( id );
                
                elSlot.iSlot = iSlot;
                
                return elSlot;
            }
            
            const getDesiredSlots = () => {
                const useResponsiveLayout = WINDOW.Economy_UseResponsiveLayout();
                const cTotalSlotsInUse = cSlotsInUse + cCurrencySlotsInUse;
                
                if (useResponsiveLayout) {
                    return cTotalSlotsInUse + 1;
                }
                
                return Math.max(Math.floor((cTotalSlotsInUse + 5) / 4) * 4, 8);
            };
            const $slots = bYourSlots ? page.$yourSlots : page.$theirSlots;
            // const $slots = bYourSlots ? $('#your_slots') : $('#their_slots');
            const elSlotContainer = $slots[0];
            const cDesiredSlots = getDesiredSlots();
            const cDesiredItemSlots = cDesiredSlots - cCurrencySlotsInUse;
            const cCurrentItemSlots = elSlotContainer.childElementCount;
            const cCurrentSlots = cCurrentItemSlots + cCurrencySlotsInUse;
            const bElementsChanged = cDesiredSlots !== cCurrentSlots;
            const rgElementsToRemove = [];
            
            if (cDesiredSlots > cCurrentSlots) {
                // Adding the elements to a fragment before appending to the DOM is much faster
                const fragment = document.createDocumentFragment();
                
                for (let i = cCurrentItemSlots; i < cDesiredItemSlots; i++) {
                    fragment.appendChild(createTradeSlotElement(bYourSlots, i));
                }
                
                elSlotContainer.appendChild(fragment);
            } else if (cDesiredSlots < cCurrentSlots) {
                // going to compact
                const prefix = bYourSlots ? 'your_slot_' : 'their_slot_';
                const $parent = $slots.parent();
                
                for (let i = cDesiredItemSlots; i < cCurrentItemSlots; i++) {
                    const element = $slots.find('#' + prefix + i)[0];
                    
                    element.id = '';
                    $parent.append(element.remove());
                    rgElementsToRemove.push(element);
                }
            }
            
            if (bElementsChanged && rgElementsToRemove.length > 0) {
                rgElementsToRemove.invoke('remove');
            }
        };
        
        // remove multiple items from a trade offer at once
        // pretty much removes all items INSTANTLY
        WINDOW.GTradeStateManager.RemoveItemsFromTrade = function(items) {
            function checkItems(items, isYou) {
                if (items.length === 0) {
                    return false;
                }
                
                function getGroups(rgItems) {
                    const groupBy = Utils.groupBy;
                    const grouped = groupBy(rgItems, 'appid');
                    
                    for (let appid in grouped) {
                        grouped[appid] = groupBy(grouped[appid], 'contextid');
                        
                        for (let contextid in grouped[appid]) {
                            grouped[appid][contextid] = groupBy(grouped[appid][contextid], 'id');
                        }
                    }
                    
                    return grouped;
                }
                
                // iterate over dom elements and collect rgItems from items
                function iterItems(items) {
                    let rgItems = [];
                    const revertItem = WINDOW.RevertItem;
                    const isInTradeSlot = WINDOW.BIsInTradeSlot;
                    const cleanSlot = WINDOW.CleanupSlot;
                    const setStackItemInTrade = WINDOW.SetStackableItemInTrade;
                    
                    // this is done in reverse
                    for (let i = items.length - 1; i >= 0; i--) {
                        const elItem = items[i];
                        const item = elItem.rgItem;
                        
                        if (isInTradeSlot(elItem)) {
                            cleanSlot(elItem.parentNode.parentNode);
                        }
                        
                        if (item.is_stackable) {
                            // stackable items are fully removed by this call
                            setStackItemInTrade(item, 0);
                            continue;
                        }
                        
                        revertItem(item);
                        item.homeElement.down('.slot_actionmenu_button').show();
                        rgItems.push(item);
                    }
                    
                    return rgItems;
                }
                
                // iterate assets in slots
                function iterAssets(rgItems) {
                    if (rgItems.length === 0) {
                        return false;
                    }
                    
                    const getItem = ({ appid, contextid, assetid }) => {
                        return (
                            groups[appid] &&
                            groups[appid][contextid] &&
                            groups[appid][contextid][assetid]
                        );
                    };
                    const slots = isYou ? TRADE_STATUS.me : TRADE_STATUS.them;
                    const groups = getGroups(rgItems);
                    let assets = slots.assets;
                    let bChanged;
                    
                    for (let i = assets.length - 1; i >= 0; i--) {
                        const asset = assets[i];
                        const item = getItem(asset);
                        
                        if (item) {
                            bChanged = true;
                            assets.splice(i, 1);
                        }
                    }
                    
                    return bChanged;
                }
                
                // return true if any assets were removed from trade
                return iterAssets(iterItems(items));
            }
            
            const manager = WINDOW.GTradeStateManager;
            const [yours, theirs] = Utils.partition(items, (elItem) => {
                return !elItem.rgItem.is_their_item;
            });
            const hasChanged = [
                checkItems(yours, true),
                checkItems(theirs, false)
            ].some(Boolean);
            
            if (hasChanged) {
                manager.m_bChangesMade = true;
                manager.UpdateTradeStatus();
            }
        };
    }
}