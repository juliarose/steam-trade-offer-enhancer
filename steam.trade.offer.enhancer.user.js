// ==UserScript==
// @name        Steam Trade Offer Enhancer
// @description Browser script to enhance Steam trade offers.
// @version     2.2.4
// @author      Julia
// @namespace   http://steamcommunity.com/profiles/76561198080179568/
// @updateURL   https://github.com/juliarose/steam-trade-offer-enhancer/raw/master/steam.trade.offer.enhancer.meta.js
// @downloadURL https://github.com/juliarose/steam-trade-offer-enhancer/raw/master/steam.trade.offer.enhancer.user.js
// @grant       GM_addStyle
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       unsafeWindow
// @run-at      document-end
// @include     /^https?:\/\/(.*\.)?backpack\.tf(:\\d+)?\/(stats|classifieds).*/
// @include     /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/(?:id|profiles)\/.*/
// @include     /^https?:\/\/steamcommunity\.com\/market\/listings\/440\/.*/
// @include     /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/[^\/]+\/inventory(?:[/#].*|$)/
// @include     /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/[^\/]+(\/$|\?|$)/
// @include     /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/.*\/tradeoffers/
// @include     /^https?:\/\/steamcommunity\.com\/tradeoffer.*/
// ==/UserScript==


const scripts = [
    {
        includes: [
            /^https?:\/\/(.*\.)?backpack\.tf(:\\d+)?\/(stats|classifieds).*/
        ],
        fn: function main({ Utils }) {
            const dom = {
                listingsElList: document.getElementsByClassName('listing')
            };
            
            Array.from(dom.listingsElList).forEach((listingEl) => {
                const itemEl = listingEl.getElementsByClassName('item')[0];
                const offerButtonEl = listingEl.getElementsByClassName('listing-buttons')[0].lastElementChild;
                const href = offerButtonEl.getAttribute('href');
                const {
                    listing_intent,
                    listing_price
                } = itemEl.dataset;
                const currencies = Utils.stringToCurrencies(listing_price);
                
                // no currencies
                if (currencies === null) {
                    // continue
                    return;
                }
                
                // array of query string parameters
                // e.g. ['listing_intent=1', 'listing_currencies_keys=2']
                const query = (function getQuery() {
                    const params = {
                        listing_intent: listing_intent === 'buy' ? 0 : 1
                    };
                    
                    for (let k in currencies) {
                        params['listing_currencies_' + k] = currencies[k];
                    }
                    
                    return Object.entries(params).map(([k, v]) => {
                        return k + '=' + v;
                    });
                }());
                // url with query added
                const url = [
                    href,
                    ...query
                ].join('&');
                
                offerButtonEl.setAttribute('href', url);
            });
        }
    },
    {
        includes: [
            /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/(?:id|profiles)\/.*/
        ],
        fn: function main({ $, Utils, getStored, setStored }) {
            const urlParams = Utils.getURLParams();
            const stored = {
                key_price: 'getInventory.key_price'
            };
            const page = {
                $document: $(document),
                $backpack: $('#backpack'),
                $refined: $('.refined-value'),
                $inventorySortMenu: $('#inventory-sort-menu ul.dropdown-menu'),
                get: {
                    $selected: () => page.$backpack.find('li.item:visible:not(.unselected)'),
                    $listedItems: () => page.$backpack.find('li.item:visible:not(.unselected)[data-listing_price]'),
                    $firstSelectPage: () => page.$backpack.find('span.select-page:first'),
                    $backpackPage: () => page.$backpack.find('div.backpack-page'),
                    $itemPricedInKeys: () => page.$backpack.find('li.item[data-p_bptf*="keys"]:first'),
                    $crateKey: () => page.$backpack.find('.item[data-name="Mann Co. Supply Crate Key"]:first'),
                    $inventoryCmpFrom: () => $('#inventory-cmp-from'),
                    $inventoryCmpTo: () => $('#inventory-cmp-to')
                }
            };
            // the key value is used for displaying totals in keys
            // get key value from cache, if available
            let keyValue = getStored(stored.key_price);
            
            // called when backpack is loaded
            function onBackpackLoad() {
                // get the value of keys in metal
                // this should be very approximate, but close enough
                function getKeyValue() {
                    // gets pricing details from item element
                    function parseItem(itemEl) {
                        // parse price string e.g. "1-1.2 keys"
                        function parseString(string) {
                            const match = string.match(/^([\d\.]*)[\-\u2013]?([\d\.]*)? (\w*)/); 
                            const currencyNames = {
                                'metal': 'metal',
                                'ref': 'metal',
                                'keys': 'keys',
                                'key': 'keys'
                            };
                            
                            if (match) {
                                details.value = parseFloat(match[1]);
                                details.average = details.value;
                                details.currency = currencyNames[match[3]]; 
                                
                                // if there are 3 match groups, there is a range
                                if (match[2]) {
                                    details.value_high = parseFloat(match[2]);
                                    details.average = (details.value + details.value_high) / 2;
                                }
                            }
                        }
                        
                        function getRefinedValue(allStr) {
                            const match = allStr.replace(/\,/g, '').match(/(\d+\.?\d*) ref/);
                            const value = match && parseFloat(match[1]);
                            const rawValue = details.raw;
                            const canUseRawValue = Boolean(
                                value &&
                                rawValue &&
                                value.toFixed(2) === rawValue.toFixed(2)
                            );
                            
                            // the raw value has extra precision but includes the value of paint/strange parts.
                            // if it is close to the value of the price items,
                            // we can use the raw value instead which is more precise
                            if (canUseRawValue) {
                                return rawValue;
                            } else {
                                return value || rawValue;
                            }
                        }
                        
                        const data = itemEl.dataset;
                        const details = {};
                        
                        if (data.price) {
                            details.raw = parseFloat(data.price);
                        }
                        
                        if (data.p_bptf) {
                            parseString(data.p_bptf);
                        }
                        
                        details.refined = getRefinedValue(data.p_bptf_all || '');
                        
                        return details;
                    }
                    
                    // find item priced in keys
                    const item = page.get.$itemPricedInKeys()[0];
                    const price = item && parseItem(item);
                    const useItemPricedInKeys = Boolean(
                        price &&
                        price.currency === 'keys' &&
                        price.average &&
                        price.refined
                    );
                    
                    // use an item priced in keys to extract the key value
                    if (useItemPricedInKeys) {
                        // to get the value of keys in refined metal...
                        // take the price in metal divided by the price in keys
                        return price.refined / price.average;
                    } else {
                        // set value using the value of a key, if no items in inventory are priced in keys
                        const key = page.get.$crateKey()[0];
                        const price = (
                            key &&
                            parseItem(key)
                        );
                        
                        return (
                            price &&
                            price.refined
                        );
                    }
                }
                
                function filterItems($filtered) {
                    // no items to filter
                    if ($filtered.length === 0) {
                        return;
                    }
                    
                    const $backpack = page.$backpack;
                    const $items = $backpack.find('li.item:not(.spacer)');
                    const $unfiltered = $items.not($filtered);
                    const $spacers = $backpack.find('li.spacer');
                    // all hidden items are moved to a temp page
                    const $tempPage = $('<div class="temp-page" style="display:none;"/>');
                    
                    // sort
                    sortBy('price');
                    // then add the temp page, it will be hidden
                    $backpack.append($tempPage);
                    // remove spacers
                    $spacers.appendTo($tempPage);
                    // add the unfiltered items to the temp page
                    $unfiltered.appendTo($tempPage);
                    // hide pages that contain no items
                    page.get.$backpackPage().each((i, el) => {
                        const $page = $(el);
                        const $items = $page.find('.item-list .item');
                        
                        if ($items.length === 0) {
                            $page.hide();
                        }
                    });
                    // then update totals
                    // hackish way of updating totals
                    page.get.$firstSelectPage().trigger('click');
                    page.get.$firstSelectPage().trigger('click');
                }
                
                // selects items in inventory matching the given ids
                function selectItemsById(ids) {
                    const $backpack = page.$backpack;
                    const $items = $backpack.find('li.item:not(.spacer)');
                    const selectors = ids.map(id => `[data-id="${id}"]`);
                    // select items
                    const $filtered = $items.filter(selectors.join(','));
                    
                    filterItems($filtered);
                }
                
                function sortBy(key) {
                    page.$inventorySortMenu.find(`li[data-value="${key}"]`).trigger('click');
                }
                
                // changes the comparison
                // set up to true to go up a day, otherwise go down
                function compare(up) {
                    const $from = page.get.$inventoryCmpFrom();
                    const $to = page.get.$inventoryCmpTo();
                    const isAvailable = (
                        $from.length > 0 &&
                        !$from.hasClass('disabled')
                    );
                    
                    // no selections available
                    if (!isAvailable) {
                        return;
                    }
                    
                    const from = parseInt($from.val());
                    const to = parseInt($to.val());
                    const options = $from.find('option').map((i, el) => {
                        return parseInt(el.value);
                    }).get();
                    const filtered = options.filter((option) => {
                        if (option === to || option === from) {
                            return false;
                        } else if (up) {
                            return option > to;
                        }
                        
                        return option < to;
                    });
                    
                    // no items
                    if (filtered.length === 0) {
                        return;
                    }
                    
                    const value = up ? Math.min(...filtered) : Math.max(...filtered);
                    const abs = [from, to].map(a => Math.abs(a - value));
                    // farthest... closest? I failed math, but it works
                    const farthest = Math.min(...abs) === Math.abs(from - value) ? from : to;
                    
                    if (farthest === from) {
                        $to.val(value).trigger('change');
                    } else if (farthest === to) {
                        $from.val(value).trigger('change');
                    }
                }
                
                // get the id's of all selected items
                function getIDs() {
                    return page.get.$selected().map((i, el) => {
                        return el.dataset.id;
                    }).get();
                }
                
                function copyIDs() {
                    Utils.copyToClipboard(getIDs().join(','));
                }
                
                function keyPressed(e) {
                    Utils.execHotKey(e, {
                        // P
                        112: copyIDs,
                        // 1
                        49: () => sortBy('bpslot'),
                        // 2
                        50: () => sortBy('price'),
                        // 3
                        51: () => sortBy('market'),
                        // W
                        119: () => compare(true),
                        // S
                        115: () => compare(false)
                    });
                }
                
                // disconnect observer since the backpack has been loaded
                observer.disconnect();
                // then callback
                
                // ids are comma-seperated in select param
                const select = Utils.getIDsFromString(urlParams.select);
                // get key value using items in inventory
                const bpKeyValue = getKeyValue();
                
                if (bpKeyValue) {
                    // set keyValue to price obtained from inventory
                    // this should be very approximate. but close enough
                    keyValue = bpKeyValue;
                    // then cache it
                    setStored(stored.key_price, keyValue);
                }
                
                if (select !== null) {
                    // select items if select param is present
                    selectItemsById(select);
                }
                
                page.$document.on('keypress', (e) => {
                    keyPressed(e);
                });
            }
            
            // perform actions
            // observe changes to refined value
            {
                // get pretty value in keys
                function refinedToKeys(value) {
                    return Math.round((value / keyValue) * 10) / 10;
                }
                
                function refinedValueChanged() {
                    // this will generally always be available other than the first load
                    // if it isn't there's nothing we can do
                    if (!keyValue) return;
                    
                    // get total value of all items in keys by converting from ref value
                    const text = $refined.text().replace(/,/g, '').trim();
                    const refined = parseFloat(text);
                    const keysValue = refinedToKeys(refined);
                    
                    // disconnect so we can modify the object
                    // without calling this function again
                    observer.disconnect();
                    // update the ref value
                    $refined.text(keysValue);
                    // observe changes again
                    observeRefChanges(); 
                }
                    
                function observeRefChanges() {
                    // observe changes to ref value
                    observer.observe(refinedEl, {
                        childList: true,
                        subtree: true,
                        attributes: false,
                        characterData: false
                    });
                }
                
                // keeping this in a mouseover will speed things up a bit
                // especially if there are many items that are listed in the inventory
                function updatedListedPrice() {
                    // this will generally always be available other than the first load
                    // if it isn't there's nothing we can
                    if (!keyValue) return;
                    
                    function getKeysListedValue() {
                        // get refined value from currencies
                        const getRefinedValue = (currencies) => {
                            const keys = currencies.keys || 0;
                            const metal = currencies.metal || 0;
                            
                            return (keys * keyValue) + metal;
                        };
                        const $listedItems = page.get.$listedItems();
                        const prices = $listedItems.map((i, el) => {
                            const listingPrice = el.dataset.listing_price;
                            // get refined value of listing price
                            const currencies = Utils.stringToCurrencies(listingPrice);
                            const refined = (
                                currencies &&
                                getRefinedValue(currencies)
                            ) || 0;
                            
                            return refined;
                        }).get();
                        const sum = (a, b) => a + b;
                        const refined = prices.reduce(sum, 0);
                        
                        return refinedToKeys(refined);
                    }
                    
                    const listedKeysValue = getKeysListedValue();
                    const listedValueStr = `${listedKeysValue} keys listed value`;
                    
                    $refined.attr({
                        'title': listedValueStr,
                        'data-original-title': listedValueStr
                    });
                    // clear title
                    $refined.attr('title', ''); 
                }
                
                const observer = new MutationObserver(refinedValueChanged);
                const $refined = page.$refined;
                const refinedEl = $refined[0];
                
                // change the text from "refined" to "keys"
                page.$refined.closest('li').find('small').text('keys'); 
                refinedValueChanged();
                $refined.on('mouseover', updatedListedPrice);
            }
            
            const observer = new MutationObserver((mutations) => {
                // if the mutations include a ".item-list" element, items have been added
                const hasItemList = mutations.some((mutation) => {
                    return Boolean(
                        mutation.addedNodes &&
                        mutation.target.className === 'item-list'
                    );
                });
                
                if (hasItemList) {
                    // backpack has loaded
                    onBackpackLoad();
                }
            });
            const backpackEl = document.getElementById('backpack');
            const settings = {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            };
            
            observer.observe(backpackEl, settings);
        }
    },
    {
        includes: [
            /^https?:\/\/steamcommunity\.com\/market\/listings\/440\/.*/
        ],
        styles: `
            .unusual {
                background-position: center !important;
                background-size: 100% 100%;
                background-repeat: no-repeat;
            }
            
            .uncraft {
                border-style: dashed !important;
            }
            
            .strange:before {
                content: " ";
                position: absolute;
                z-index: 1;
                top: 2px;
                left: 2px;
                right: 2px;
                bottom: 2px;
                border: 2px solid rgba(207, 106, 50, 0.5);
                /* box-shadow: inset 0px 0px 12px 0px #CF6A32; */
            }
            
            .icons img.spell {
                width: 14px;
                height: 20px;
            }
            
            .icons img.parts {
                width: 14px;
                height: 20px;
            }
                        
            .icons img.ks {
                width: 14px;
                height: 15px;
            }
            
            .lowcraft {
                user-select: none;
                right: 4%;
                bottom: 4%;
                text-align: end;
                width: 50%;
                font-size: 16px;
                z-index: 1;
                line-height: 1;
                position: absolute;
                pointer-events: none;
            }
            
            .icons > * {
                margin-right: 4%;
            }
            
            .icons {
                position: absolute;
                pointer-events: none;
                bottom: 4%;
                left: 4%;
                width: 92%;
                height: 20px;
            }
        `,
        fn: function main({ WINDOW, shared }) {
            const dom = {
                resultsRows: document.getElementById('searchResultsRows')
            };
            
            // gets the appid, contextid and assetid from an element
            function getItem(rowEl) {
                const buyButtonLinkEl = rowEl.querySelector('div.market_listing_buy_button a');
                
                if (!buyButtonLinkEl) {
                    return null;
                }
                
                const href = buyButtonLinkEl.getAttribute('href');
                const params = href.replace('javascript:BuyMarketListing', '').replace(/[\,\(/) ]/g, '');
                const split = params.split(/'(.+?)'/g).filter(a => a);
                const [ , , appid, contextid, assetid] = split;
                
                return {
                    appid,
                    contextid,
                    assetid
                };
            }
            
            // gets an item's asset
            function getAsset({ appid, contextid, assetid }) {
                const assets = WINDOW.g_rgAssets;
                
                return (
                    assets[appid] &&
                    assets[appid][contextid] &&
                    assets[appid][contextid][assetid]
                );
            }
            
            function addAttributesToResults() {
                const rowsList = dom.resultsRows.getElementsByClassName('market_listing_row');
                const {
                    addAttributes
                } = shared.offers.identifiers;
                
                Array.from(rowsList).forEach((rowEl) => {
                    // extract item data from this row
                    const item = getItem(rowEl);
                    // get asset data from that data
                    const asset = (
                        item &&
                        getAsset(item)
                    );
                    
                    // no asset for whatever reason
                    if (asset == null) {
                        // continue
                        return;
                    }
                    
                    // get the container for the item image
                    const itemImgContainerEl = rowEl.querySelector('div.market_listing_item_img_container');
                    // get the image element
                    const itemImgEl = itemImgContainerEl.querySelector('img.market_listing_item_img');
                    // we create another element to wrap the image element in for styling purposes
                    const itemEl = (function() {
                        const el = document.createElement('div');
                        const imgSrc = itemImgEl.getAttribute('src');
                        
                        el.classList.add('market_listing_item_img', 'economy_item_hoverable');
                        el.setAttribute('style', itemImgEl.getAttribute('style'));
                        el.style.position = 'relative';
                        el.style.backgroundImage = `url('${imgSrc}')`;
                        
                        return el;
                    }());
                    
                    // remove attributes from the image element
                    itemImgEl.classList.remove('market_listing_item_img');
                    itemImgEl.style.backgroundColor = 'transparent';
                    
                    // add it to our newly created item elment
                    itemEl.appendChild(itemImgEl);
                    
                    // then add it to the container - this effectively wraps the image in another element
                    itemImgContainerEl.appendChild(itemEl);
                    
                    // now add the attributes to this item
                    addAttributes(asset, itemEl);
                });
            }
            
            // add the initial elements
            addAttributesToResults();
            
            // observe changes to rows
            {
                const observer = new MutationObserver(addAttributesToResults);
                
                observer.observe(dom.resultsRows, {
                    childList: true
                });
            }
        }
    },
    {
        includes: [
            /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/[^\/]+\/inventory(?:[/#].*|$)/
        ],
        styles: `
            .unusual {
                background-position: center !important;
                background-size: 100% 100%;
                background-repeat: no-repeat;
            }
            
            .uncraft {
                border-style: dashed !important;
            }
            
            .strange:before {
                content: " ";
                position: absolute;
                z-index: 1;
                top: 2px;
                left: 2px;
                right: 2px;
                bottom: 2px;
                border: 2px solid rgba(207, 106, 50, 0.5);
                /* box-shadow: inset 0px 0px 12px 0px #CF6A32; */
            }
            
            .icons img.spell {
                width: 14px;
                height: 20px;
            }
            
            .icons img.parts {
                width: 14px;
                height: 20px;
            }
                        
            .icons img.ks {
                width: 14px;
                height: 15px;
            }
            
            .lowcraft {
                user-select: none;
                right: 4%;
                bottom: 4%;
                text-align: end;
                width: 50%;
                font-size: 16px;
                z-index: 1;
                line-height: 1;
                position: absolute;
                pointer-events: none;
            }
            
            .icons > * {
                margin-right: 4%;
            }
            
            .icons {
                position: absolute;
                pointer-events: none;
                bottom: 4%;
                left: 4%;
                width: 92%;
                height: 20px;
            }
        `,
        fn: function main({ WINDOW, shared }) {
            const dom = {
                inventory: document.getElementById('inventories'),
                get: {
                    tf2Inventory: () => {
                        const userSteamId = WINDOW.UserYou.strSteamId;
                        const app440InventoryId = `inventory_${userSteamId}_440_2`;
                        
                        return document.getElementById(app440InventoryId);
                    },
                    items: () => {
                        const inventory = dom.get.tf2Inventory();
                        
                        if (!inventory) {
                            return [];
                        }
                        
                        return Array.from(inventory.querySelectorAll('.item:not(.pendingItem)'));
                    }
                }
            };
            
            // tf2 inventory has changed
            function onTF2InventoryChange() {
                function getAsset(assets, itemEl) {
                    const [ , , assetid] = itemEl.id.split('_');
                    
                    return assets[assetid];
                }
                
                // tf2 assets
                const inventory = (
                    WINDOW.g_rgAppContextData &&
                    WINDOW.g_rgAppContextData[440] &&
                    WINDOW.g_rgAppContextData[440].rgContexts &&
                    WINDOW.g_rgAppContextData[440].rgContexts[2] &&
                    WINDOW.g_rgAppContextData[440].rgContexts[2].inventory
                );
                
                // no tf2 inventory in contexts
                if (!inventory) {
                    // stop
                    return;
                }
                
                const {
                    addAttributes
                } = shared.offers.identifiers;
                const assets = inventory.m_rgAssets;
                const itemsList = dom.get.items();
                
                itemsList.forEach((itemEl) => {
                    const asset = getAsset(assets, itemEl);
                    // item is stored in description of asset
                    const item = asset.description;
                    
                    // add the attributes to this item
                    addAttributes(item, itemEl);
                });
            }
            
            // a tf2 inventory was loaded on the page
            function onTF2Inventory(tf2Inventory) {
                const observer = new MutationObserver(onTF2InventoryChange);
                
                // observe changes to the tf2 inventory
                observer.observe(tf2Inventory, {
                    childList: true
                });
                
                onTF2InventoryChange();
            }
            
            // observe changes to dom
            {
                const inventoryEl = dom.inventory;
                // wait for the tf2 inventory to be loaded
                const observer = new MutationObserver(() => {
                    const tf2Inventory = dom.get.tf2Inventory();
                    const tf2InventoryVisible = Boolean(
                        tf2Inventory &&
                        tf2Inventory.style.display !== 'none'
                    );
                    const itemsList = dom.get.items();
                    
                    // make sure the inventory is visible and it contains visible items
                    if (tf2InventoryVisible && itemsList.length > 0) {
                        // disconnect the observer
                        observer.disconnect();
                        onTF2Inventory(tf2Inventory);
                    }
                });
                
                observer.observe(inventoryEl, {
                    childList: true,
                    subtree: true
                });
            }
        }
    },
    {
        includes: [
            /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/[^\/]+(\/$|\?|$)/
        ],
        styles: `
            .unusual {
                background-position: center !important;
                background-size: 100% 100%;
                background-repeat: no-repeat;
            }
            
            .uncraft {
                border-style: dashed !important;
            }
            
            .strange:before {
                content: " ";
                position: absolute;
                z-index: 1;
                top: 2px;
                left: 2px;
                right: 2px;
                bottom: 2px;
                border: 2px solid rgba(207, 106, 50, 0.5);
                /* box-shadow: inset 0px 0px 12px 0px #CF6A32; */
            }
            
            .icons img.spell {
                width: 14px;
                height: 20px;
            }
            
            .icons img.parts {
                width: 14px;
                height: 20px;
            }
                        
            .icons img.ks {
                width: 14px;
                height: 15px;
            }
            
            .lowcraft {
                user-select: none;
                right: 4%;
                bottom: 4%;
                text-align: end;
                width: 50%;
                font-size: 16px;
                z-index: 1;
                line-height: 1;
                position: absolute;
                pointer-events: none;
            }
            
            .icons > * {
                margin-right: 4%;
            }
            
            .icons {
                position: absolute;
                pointer-events: none;
                bottom: 4%;
                left: 4%;
                width: 92%;
                height: 20px;
            }
            
            .item_showcase_item {
                line-height: inherit !important;
            }
        `,
        fn: function main({ addAttributesToHoverItems }) {
            const itemsList = document.getElementsByClassName('item_showcase_item');
            
            // add attributes to images - so easy!
            addAttributesToHoverItems(itemsList);
        }
    },
    {
        includes: [
            /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/.*\/tradeoffers/
        ],
        styles: `
            .btn_user_link {
                background-position: 14px 0px;
                background-repeat: no-repeat !important;
                width: 0;
                margin-top: -8px;
                margin-left: 6px;
                padding-left: 44px;
                line-height: 30px;
                float: right;
            }
            
            .btn_user_link:hover {
                background-position: 14px -30px !important;
                background-color: #808285;
            }
            
            .rep_btn {
                background-image: url(https://i.imgur.com/OD9rRAB.png) !important;
            }
            
            .backpack_btn {
                background-image: url(https://i.imgur.com/8LvnfuX.png) !important;
            }
            
            .tradeoffer_items_summary {
                position: relative;
                background-color: #1D1D1D;
                border: 1px solid #3D3D3E;
                border-radius: 5px;
                padding: 17px;
                margin-top: 8px;
                width: 100%;
                font-size: 12px;
                color: #FFFFFF;
                display: flex;
                box-sizing: border-box;
            }
            
            .items_summary {
                width: 50%;
                margin-right: 2.1%;
                display: inline-block;
            }
            
            .items_summary:last-child {
                margin-right: 0;
            }
            
            .summary_header {
                margin-bottom: 12px;
            }
            
            .summary_item {
                display: inline-block;
                width: 44px;
                height: 44px;
                padding: 3px;
                margin: 0 2px 2px 0;
                border: 1px solid;
                background-color: #3C352E;
                background-position: center;
                background-size: 44px 44px;
                background-repeat: no-repeat;
            }
            
            .summary_badge {
                position: absolute;
                top: 4px;
                left: 4px;
                padding: 1px 3px;
                color: #FFFFFF;
                border-radius: 4px;
                background-color: #209DE6;
                font-size: 14px;
                cursor: default;
                font-weight: bold;
            }
            
            .unusual {
                background-position: center !important;
                background-size: 100% 100%;
                background-repeat: no-repeat;
            }
            
            .uncraft {
                border-style: dashed !important;
            }
            
            .strange:before {
                content: " ";
                position: absolute;
                z-index: -1;
                top: 2px;
                left: 2px;
                right: 2px;
                bottom: 2px;
                border: 2px solid rgba(207, 106, 50, 0.5);
                /* box-shadow: inset 0px 0px 12px 0px #CF6A32; */
            }
            
            .icons img.spell {
                width: 14px;
                height: 20px;
            }
            
            .icons img.parts {
                width: 14px;
                height: 20px;
            }
                        
            .icons img.ks {
                width: 14px;
                height: 15px;
            }
            
            .lowcraft {
                user-select: none;
                right: 4%;
                bottom: 4%;
                text-align: end;
                width: 50%;
                font-size: 16px;
                z-index: 1;
                line-height: 1;
                position: absolute;
                pointer-events: none;
            }
            
            .icons > * {
                margin-right: 4%;
            }
            
            .icons {
                position: absolute;
                pointer-events: none;
                bottom: 4%;
                left: 4%;
                width: 92%;
                height: 20px;
            }
            
            .decline_active_button {
                display: block;
                margin-top: 0.6em;
                text-align: center;
            }
        `,
        fn: function main({ WINDOW, addAttributesToHoverItems }) {
            const dom = {
                offers: document.getElementsByClassName('tradeoffer')
            };
            
            // modify each trade offer
            Array.from(dom.offers).forEach((offerEl) => {
                // add buttons to the offer
                const reportButtonEl = offerEl.getElementsByClassName('btn_report')[0];
                
                // sent offers will not have a report button - we won't add any buttons to them
                if (reportButtonEl != null) {
                    // match steamid, personaname
                    const pattern = /ReportTradeScam\( ?\'(\d{17})\', ?"(.*)"\ ?\)/;
                    const match = (reportButtonEl.getAttribute('onclick') || '').match(pattern);
                    
                    if (match) {
                        const [ , steamid, personaname] = match;
                        
                        // generate the html for the buttons
                        const html = (function getButtons() {
                            // generate html for button
                            const getButton = (button) => {
                                const makeReplacements = (string) => {
                                    // replace personaname and steamid
                                    return string.replace('%personaname%', personaname).replace('%steamid%', steamid); 
                                };
                                const href = makeReplacements(button.url);
                                const title = makeReplacements(button.title);
                                const classes = [
                                    button.className,
                                    'btn_grey_grey',
                                    'btn_small',
                                    'btn_user_link'
                                ];
                                
                                return `<a href="${href}" title="${title}" class="${classes.join(' ')}">&nbsp;</a>`;
                            };
                            // all the lovely buttons we want to add
                            const buttons = [
                                {
                                    title: 'View %personaname%\'s backpack',
                                    // %steamid% is replaced with user's steamid
                                    url: 'https://backpack.tf/profiles/%steamid%',
                                    // each button has a class name for which image to use
                                    className: 'backpack_btn'
                                },
                                {
                                    title: 'View %personaname%\'s Rep.tf page',
                                    url: 'https://rep.tf/%steamid%',
                                    className: 'rep_btn' 
                                }
                            ].map(getButton);
                            // reverse to preserve order
                            const html = buttons.reverse().join('');
                            
                            return html;
                        }());
                        
                        // insert html for buttons
                        reportButtonEl.insertAdjacentHTML('beforebegin', html);
                    }
                    
                    // we don't really want it
                    reportButtonEl.remove();
                }
                
                // summarize the offer
                const itemsList = offerEl.getElementsByClassName('tradeoffer_item_list');
                
                // summarize each list
                Array.from(itemsList).forEach((itemsEl) => {
                    const itemsArr = Array.from(itemsEl.getElementsByClassName('trade_item'));
                    const getClassInfo = (itemEl) => {
                        return itemEl.getAttribute('data-economy-item');
                    };
                    // has multiples of the same item
                    const hasMultipleSameItems = Boolean(function() {
                        let infos = [];
                        
                        return itemsArr.some((itemEl) => {
                            let classinfo = getClassInfo(itemEl);
                            
                            if (infos.indexOf(classinfo) !== -1) {
                                return true;
                            } else {
                                infos.push(classinfo);
                                return false;
                            }
                        });
                    }());
                    const shouldModifyDOM = Boolean(
                        itemsArr.length > 0 &&
                        hasMultipleSameItems
                    );
                    
                    // only modify dom if necessary
                    if (!shouldModifyDOM) {
                        // continue
                        return;
                    }
                    
                    const fragment = document.createDocumentFragment();
                    const clearEl = document.createElement('div');
                    // get summarized items and sort elements by properties
                    // most of this stuff should be fairly optimized
                    const items = (function() {
                        const getSort = (key, item) => {
                            let index, value;
                            
                            if (key === 'count') {
                                index = -item.count;
                            } else {
                                value = item.props[key];
                                index = sorts[key].indexOf(value);
                                
                                if (index === -1) {
                                    sorts[key].push(value);
                                    index = sorts[key].indexOf(value);
                                }
                            }
                            
                            return index;
                        };
                        // some parameters to sort by
                        const sorts = {
                            app: [
                                // team fortress 2
                                '440',
                                // csgo
                                '730'
                            ],
                            color: [
                                // unusual
                                'rgb(134, 80, 172)',
                                // collectors
                                'rgb(170, 0, 0)',
                                // strange
                                'rgb(207, 106, 50)',
                                // haunted
                                'rgb(56, 243, 171)',
                                // genuine
                                'rgb(77, 116, 85)',
                                // vintage
                                'rgb(71, 98, 145)',
                                // decorated
                                'rgb(250, 250, 250)',
                                // unique
                                'rgb(125, 109, 0)'
                            ]
                        };
                        // this reduces the items on the page and puts them into
                        // a group which contains the count for that item
                        const items = (function() {
                            const getItem = (classinfo, itemEl) => {
                                return {
                                    classinfo,
                                    app: classinfo.replace('classinfo/', '').split('/')[0],
                                    color: itemEl.style.borderColor
                                };
                            };
                            const items = itemsArr.reduce((result, itemEl) => {
                                const classinfo = getClassInfo(itemEl);
                                
                                if (result[classinfo]) {
                                    result[classinfo].count += 1;
                                } else {
                                    result[classinfo] = {
                                        el: itemEl,
                                        count: 1,
                                        props: getItem(classinfo, itemEl)
                                    };
                                }
                                
                                return result;
                            }, {});
                            
                            return Object.values(items);
                        }());
                        const sorted = items.sort((a, b) => {
                            let index = 0;
                            
                            // sort by these keys
                            // break when difference is found
                            [
                                'app',
                                'color',
                                'count'
                            ].find((key) => {
                                // get the sort value for a and b
                                const [sortA, sortB] = [a, b].map((value) => {
                                    return getSort(key, value);
                                });
                                
                                // these are already sorted in the proper direction
                                if (sortA > sortB) {
                                    index = 1;
                                    return true;
                                } else if (sortA < sortB) {
                                    index = -1;
                                    return true;
                                }
                            });
                            
                            return index;
                        });
                        
                        return sorted;
                    }());
                    
                    items.forEach(({ el, count }) => {
                        if (count > 1) {
                            // add badge
                            const badgeEl = document.createElement('span');
                            
                            badgeEl.classList.add('summary_badge');
                            badgeEl.textContent = count;
                            
                            el.appendChild(badgeEl);
                        }
                        
                        fragment.appendChild(el);
                    });
                    
                    clearEl.style.clear = 'both';
                    // add clearfix to end of fragment
                    fragment.appendChild(clearEl);
                    // clear html before-hand to reduce dom manipulation
                    itemsEl.innerHTML = '';
                    itemsEl.appendChild(fragment);
                });
            });
            
            // add attributes to images
            {
                const itemsList = document.getElementsByClassName('trade_item');
                
                addAttributesToHoverItems(itemsList);
            }
            
            // add the button to decline all trade offers
            {
                const { ShowConfirmDialog, ActOnTradeOffer } = WINDOW;
                // gets an array of id's of all active trade offers on page
                const getActiveTradeOfferIDs = () => {
                    const getTradeOfferIDs = (tradeOffersList) => {
                        const getTradeOfferID = (el) => el.id.replace('tradeofferid_', '');
                        
                        return tradeOffersList.map(getTradeOfferID);
                    };
                    const isActive = (el) => !el.querySelector('.inactive');
                    const tradeOffersList = Array.from(document.getElementsByClassName('tradeoffer'));
                    const activeTradeOffersList = tradeOffersList.filter(isActive);
                    
                    return getTradeOfferIDs(activeTradeOffersList);
                };
                // declines any number of trades by their id
                const declineOffers = (tradeOfferIDs) => {
                    const declineOffer = (tradeOfferID) => {
                        ActOnTradeOffer(tradeOfferID, 'decline', 'Trade Declined', 'Decline Trade');
                    };
                    
                    tradeOfferIDs.forEach(declineOffer);
                };
                
                const newTradeOfferBtnEl = document.querySelector('.new_trade_offer_btn');
                const canAct = Boolean(
                    // this should probably always be there...
                    // but maybe not always
                    newTradeOfferBtnEl &&
                    // page must have active trade offers
                    getActiveTradeOfferIDs().length > 0
                );
                
                if (!canAct) {
                    // stop right there
                    return;
                }
                
                const declineAllButtonEl = (function() {
                    const el = document.createElement('div');
                    const textEl = document.createElement('span');
                    
                    el.appendChild(textEl);
                    el.classList.add('btn_darkred_white_innerfade', 'btn_medium', 'decline_active_button');
                    textEl.textContent = 'Decline All Active...';
                    
                    return el;
                }());
                
                // add the button... after the "New Trade Offer" button
                newTradeOfferBtnEl.parentNode.insertBefore(declineAllButtonEl, newTradeOfferBtnEl.nextSibling);
                
                // add the handler to show the dialog on click
                declineAllButtonEl.addEventListener('click', () => {
                    ShowConfirmDialog(
                        'Decline Active',
                        'Are you sure you want to decline all active trade offers?',
                        'Decline Trade Offers',
                        null
                    ).done((str) => {
                        // yes
                        const responseIsYes = str === 'OK';
                        
                        if (responseIsYes) {
                            const tradeOfferIDs = getActiveTradeOfferIDs();
                            
                            declineOffers(tradeOfferIDs);
                            declineAllButtonEl.remove();
                        }
                    });
                });
            }
        }
    },
    {
        includes: [
            /^https?:\/\/steamcommunity\.com\/tradeoffer.*/
        ],
        styles: `
            #tradeoffer_items_summary {
                font-size: 12px;
                color: #FFFFFF;
            }
            
            #add_btns .btn_small > span {
                padding: 0 12px;
            }
            
            .btn_green {
                background-color: #709D3C;
            }
            
            .btn_silver {
                background-color: #676767;
            }
            
            .btn_blue {
                background-color: #2E4766;
            }
            
            .btn_small {
                user-select: none;
            }
            
            .summary_item {
                display: inline-block;
                position: relative;
                width: 48px;
                height: 48px;
                padding: 3px;
                margin: 0 2px 2px 0;
                border: 1px solid;
                background-color: #3C352E;
                background-position: center;
                background-size: 48px 48px, 100% 100%;
                background-repeat: no-repeat;
            }
            
            .summary_badge {
                padding: 1px 3px;
                border-radius: 4px;
                background-color: #209DE6;
                font-size: 12px;
            }
            
            .items_summary {
                margin-top: 8px
            }
            
            .summary_header {
                margin-bottom: 4px;
            }
            
            .filter_full {
                width: 200px;
            }
            
            .filter_number {
                width: 110px;
            }
            
            .control_fields {
                margin-top: 8px
            }
            
            .warning {
                color: #FF4422;
            }
            
            .trade_area .item.unusual.hover {
                background-position: center;
                background-color: #474747 !important;
            }
            
            .unusual {
                background-position: center !important;
                background-size: 100% 100%;
                background-repeat: no-repeat;
            }
            
            .uncraft {
                border-style: dashed !important;
            }
            
            .strange:before {
                content: " ";
                position: absolute;
                z-index: 1;
                top: 2px;
                left: 2px;
                right: 2px;
                bottom: 2px;
                border: 2px solid rgba(207, 106, 50, 0.5);
                /* box-shadow: inset 0px 0px 12px 0px #CF6A32; */
            }
            
            .icons img.spell {
                width: 14px;
                height: 20px;
            }
            
            .icons img.parts {
                width: 14px;
                height: 20px;
            }
                        
            .icons img.ks {
                width: 14px;
                height: 15px;
            }
            
            .lowcraft {
                user-select: none;
                right: 4%;
                bottom: 4%;
                text-align: end;
                width: 50%;
                font-size: 16px;
                z-index: 1;
                line-height: 1;
                position: absolute;
                pointer-events: none;
            }
            
            .icons > * {
                margin-right: 4%;
            }
            
            .icons {
                position: absolute;
                pointer-events: none;
                bottom: 4%;
                left: 4%;
                width: 92%;
                height: 20px;
            }
        `,
        fn: function main({ WINDOW, $, Utils, shared, getStored, setStored }) {
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
                tradeOfferWindow.userChanged(page.get.$activeInventoryTab());
                
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
    }
];

// These are shared between page scripts.
const DEPS = (function() {
    // current version number of script
    const VERSION = '2.2.4';
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
        VERSION,
        WINDOW,
        $,
        Utils,
        shared,
        addAttributesToHoverItems,
        setStored,
        getStored
    };
    
}());
const script = scripts.find(({includes}) => {
    return includes.some((pattern) => {
        return Boolean(window.location.href.match(pattern));
    });
});

if (script) {
    if (script.styles) {
        // add the styles
        GM_addStyle(script.styles);
    }
    
    if (script.fn) {
        // run the script
        script.fn(DEPS);
    }
}