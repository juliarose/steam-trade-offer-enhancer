// @include /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/[^\/]+\/inventory(?:[/#].*|$)/
function main({ WINDOW, shared }) {
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