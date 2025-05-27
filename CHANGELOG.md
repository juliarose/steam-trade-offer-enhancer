# Changelog

## [2.2.5] - 2025-05-27
### Fixed
- Adds pointer-events: none; to the divs containing the low craft number and the strange part/killstreak icons. <https://github.com/juliarose/steam-trade-offer-enhancer/pull/12>

## [2.2.4] - 2025-05-07
### Added
- Strange part and killstreak icons. <https://github.com/juliarose/steam-trade-offer-enhancer/pull/10>
- Halloween 2024 effects.
- Smissmas 2024 effects.

### Fixed
- Steam inventory path.
- Effect images not loading.

## [2.2.3] - 2024-07-23
### Fixed
- A bug where the items did not summarize for sent trade offers.

## [2.2.2] - 2024-07-22
### Added
- Summer 2024 effects.

### Changed
- Refactored code for better maintainability, readability, and performance.
- Adding items to trade offers should now be over 3 times faster. This is mostly as a result of changing some of Steam's core JavaScript which has many inefficiencies but only so much can be done without changing things too significantly.

## [2.2.1] - 2024-05-26
### Fixed
- A potential issue where items display the wrong item.

## [2.2.0] - 2023-12-25
### Added
- Halloween 2023 effects.
- Smissmas 2023 effects.

## [2.1.9] - 2023-07-30
### Added
- Smissmas 2022 effects.
- Summer 2023 effects.

## [2.1.8] - 2022-10-12
### Fixed
- An issue where an item would load endlessly in some cases.

## [2.1.7] - 2022-10-11
### Added
- Halloween 2022 effects.

## [2.1.6] - 2022-03-30
### Added
- Low craft numbers from [pull request](https://github.com/juliarose/steam-trade-offer-enhancer/pull/2).
- Margins for spell icons.

## [2.1.5] - 2022-01-31
### Added
- Smissmas 2021 effects.

## [2.1.4] - 2021-10-30
### Added
- Summer 2021 effects.
- Halloween 2021 effects.

## [2.1.3] - 2020-05-12
### Changed
- "Add Recent" button will add the next most recent items for each click.
- "Add Recent" button will now only pick items based on filtered items.

## [2.1.2] - 2020-05-10
### Fixed
- Bug with adding "undefined" particle images on items in tradeoffer pages.

### Added
- "Add Recent" button to add the most recently obtained items.

## [2.1.1] - 2020-03-20
### Fixed
- Bug with spelled/non-spelled items mistakenly showing as spelled due to attribute caches.

### Changed
- Adding multiple items is now instant.

## [2.1.0] - 2020-12-10
### Added
- Community Sparkle effect.
- Smissmas 2020 effects.

### Changed
- Processing item attributes is now faster.

## [2.0.9] - 2020-11-30
### Fixed
- Crash because of marketplace cross listings on classifieds.

## [2.0.8] - 2020-10-17
### Added
- Scream Fortress 2020 effects.

## [2.0.7] - 2020-10-07
### Fixed
- The decline all active offers button not appearing on page.

## [2.0.6] - 2020-10-06
### Fixed
- Strange weapons not showing strange border.

## [2.0.5] - 2020-09-12
### Added
- Summer 2020 effects.

### Fixed
- Bug that allowed you to modify existing offers outside of the counter-offer state.

## [2.0.4] - 2020-08-23
### Fixed
- Effect images.

## [2.0.3] - 2020-06-04
### Fixed
- Images for summaries on spelled items. 

## [2.0.2] - 2020-06-04
### Fixed
- CSS positioning for spell icons on Steam profile pages.

## [2.0.1] - 2020-06-03
### Added
- Attributes are now displayed on profile and market listings pages.

### Changed
- Unusual items on tradeoffers pages are checked first.

## [2.0.0] - 2020-05-31
### Added
- Strange, spell, and uncraftable attributes are now visible on items.

### Removed
- Summary warnings as they are no longer very necessary.

## [1.9.8] - 2020-03-18
### Fixed
- Bug with effect images.

## [1.9.7] - 2020-03-16
### Fixed
- Something minor.

## [1.9.6] - 2020-03-16
### Added
- Smissmas 2019 effects.

## [1.9.5] - 2019-12-04
### Added
- Effect images on inventory pages.

## [1.9.4] - 2019-11-23
### Added
- Halloween 2019 hat effect images.

## [1.9.3] - 2019-09-20
### Fixed
- Bug with #inventory_displaycontrols height on Firefox on trade offer window pages.

## [1.9.2] - 2019-09-01
### Added
- A button to decline all active trade offers.

## [1.9.1] - 2019-08-19
### Fixed
- A bug when adding filtered items starting at the wrong index.

## [1.9.0] - 2019-06-22
### Fixed
- Code consistency.

## [1.8.9] - 2019-05-06
### Fixed
- Issue with attaining key price from some inventories resulting in values to be off.

## [1.8.8] - 2019-04-29
### Fixed
- Index on "Add listing".

## [1.8.7] - 2019-04-27
### Fixed
- Effect images in summaries on trade offer pages not using the full width.

## [1.8.6] - 2019-04-26
### Removed
- Leftovers.

## [1.8.5] - 2019-04-26
### Fixed
- Summaries on tradeoffers pages.

## [1.8.4] - 2019-04-26
### Added
- All trade offers on tradeoffers pages are now summarized and sorted based on quality and count.

### Removed
- "Show summaries" button.

## [1.8.3] - 2019-04-22
### Fixed
- Summaries on tradeoffers pages.

## [1.8.2] - 2019-04-22
### Fixed
- "Purple Confetti" effect not displaying. The image was not available on backpack.tf, so a different version of the image is requested instead.

## [1.8.1] - 2019-04-22
### Changed
- More optimizations.
- Value in keys on inventories now appears immediately on page load.

## [1.8.0] - 2019-04-21
### Added
- Unusual effect images.

### Changed
- More optimizations.

## [1.7.1] - 2019-04-17
### Added
- Auto-updater.

## [1.7.0] - 2019-04-15
### Added
- Trade offer pages now have summaries. Click the "Summary" button below each trade offer to reveal it.
- Hotkeys to change between comparisons on backpack.tf pages. Use "W" and "S" keys.
- Hotkey to copy IDs of selected items on backpack.tf. Use "P" key.
- Hotkeys to sort items. Use "1", "2", and "3" keys.
- Cookie settings for ID field visibility.
- Features from https://github.com/juliarose/steam-trade-offer-links

### Removed
- Dependencies.
- Animations in trade offers by over-riding Steam's core javascript.

### Fixed
- Animations.

### Changed
- More optimizations.
- Clear item buttons now remove items instantly.

## [1.6.2] - 2019-04-12
### Added
- Field to add by ID, just press "P" outside of a text field to access it.

### Removed
- Dependencies.

### Fixed
- Warnings not working.
- RegExp in includes.

### Changed
- Some spacing with elements.
- More optimizations.
- Used MutationObserver for checking when backpack on backpack.tf is loaded rather than waitForKeyElements. The function is now called instantly when the backpack is loaded.

## [1.6.1] - 2019-04-11
### Fixed
- Summary descriptions having a single quote.
- Issue with adding by ID.
- Spacing in summaries.

### Changed
- Cleaned code.
- Some optimization here and there.
- Interval period when adding multiple items (from 10 to 20).

## [1.6.0] - 2019-04-11
### Changed
- Cleaned code.

## [1.5.1] - 2019-04-05
### Added
- Add items by ID (only available through console in current state).

## [1.5.0] - 2018-11-13
### Added
- Refreshing summaries after every 5 seconds.

### Changed
- Listing intents on backpack.tf being written as "buy" or "sell" on listings rather than 1 or 0.

## [1.4.9] - 2018-07-08
### Added
- Summaries now link to the user's backpack with item's in offer filtered.
- backpack.tf inventory item filtering using URL query parameter "select" as comma-seperated array of item IDs.
- Refined values on backpack.tf are now displayed in keys rather than refined when available.

### Changed
- Rate of which items are removed.
- Filtering for items like keys and metal is now much faster.
- Other performance enhancements.

## ## [1.4.8] - 2018-06-10
### Added
- "Add keys" button.
- "Add metal" button.
- "Add listing price" button.
- Index field

### Changed
- Rate of which items are added.

### Removed
- Gift tag warnings as they are not needed since gift tags can be removed from items.
