import { globalObj} from '../core/global';
import { _createNode, _setAttribute, _elContains } from './general';
import { SCRIPT_TAG_SELECTOR } from './constants';
/**
 * This function handles the loading/activation logic of the already
 * existing scripts based on the current accepted cookie categories
 *
 * @param {string[]} [mustEnableCategories]
 */
export const _manageExistingScripts = (mustEnableCategories) => {

    if(!globalObj._config.manageScriptTags) return;

    var scripts = globalObj._state._allScriptTags;
    var _acceptedCategories = mustEnableCategories || globalObj._state._savedCookieContent.categories || [];
    var _acceptedServices = globalObj._state._enabledServices;

    /**
     * Load scripts (sequentially), using a recursive function
     * which loops through the scripts array
     * @param {Element[]} scripts scripts to load
     * @param {number} index current script to load
     */
    var _loadScripts = (scripts, index) => {
        if(index < scripts.length){

            var currScript = scripts[index];

            var currScriptInfo = globalObj._state._allScriptTagsInfo[index];
            var currScriptCategory = currScriptInfo._categoryName;
            var currScriptService = currScriptInfo._serviceName;
            var categoryAccepted = _elContains(_acceptedCategories, currScriptCategory);
            var serviceAccepted = currScriptService ? _elContains(_acceptedServices[currScriptCategory], currScriptService) : false;

            /**
             * Skip script if it was already executed
             */
            if(!currScriptInfo._executed){

                var categoryWasJustEnabled = !currScriptInfo._runOnDisable && categoryAccepted;
                var serviceWasJustEnabled = !currScriptInfo._runOnDisable && serviceAccepted;
                var categoryWasJustDisabled = currScriptInfo._runOnDisable && !categoryAccepted && _elContains(globalObj._state._lastChangedCategoryNames, currScriptCategory);
                var serviceWasJustDisabled = currScriptInfo._runOnDisable && !serviceAccepted && _elContains(globalObj._state._lastChangedServices[currScriptCategory] || [], currScriptService);

                if(
                    categoryWasJustEnabled
                    || categoryWasJustDisabled
                    || serviceWasJustEnabled
                    || serviceWasJustDisabled
                ){

                    currScriptInfo._executed = true;

                    currScript.removeAttribute('type');
                    currScript.removeAttribute(SCRIPT_TAG_SELECTOR);

                    // Get current script data-src (if there is one)
                    var src = currScript.getAttribute('data-src');

                    // Some scripts (like ga) might throw warning if data-src is present
                    src && currScript.removeAttribute('data-src');

                    // Create a "fresh" script (with the same code)
                    var freshScript = _createNode('script');
                    freshScript.textContent = currScript.innerHTML;

                    // Copy attributes over to the new "revived" script
                    ((destination, source) => {
                        var attributes = source.attributes;
                        var len = attributes.length;
                        for(var i=0; i<len; i++){
                            var attrName = attributes[i].nodeName;
                            _setAttribute(destination, attrName , source[attrName] || source.getAttribute(attrName));
                        }
                    })(freshScript, currScript);

                    // Set src (if data-src found)
                    src ? (freshScript.src = src) : (src = currScript.src);

                    // If script has valid "src" attribute
                    // try loading it sequentially
                    if(src){
                        // load script sequentially => the next script will not be loaded
                        // until the current's script onload event triggers
                        freshScript.onload = freshScript.onerror = () => {
                            freshScript.onload = freshScript.onerror = null;
                            _loadScripts(scripts, ++index);
                        };
                    }

                    // Replace current "sleeping" script with the new "revived" one
                    currScript.parentNode.replaceChild(freshScript, currScript);

                    /**
                     * If we managed to get here and src is still set, it means that
                     * the script is loading/loaded sequentially so don't go any further
                     */
                    if(src) return;
                }
            }

            // Go to next script right away
            _loadScripts(scripts, ++index);
        }
    };

    /**
     * Automatically Enable/Disable internal services
     */
    globalObj._state._allCategoryNames.forEach(categoryName => {
        const lastChangedServices = globalObj._state._lastChangedServices[categoryName] || globalObj._state._enabledServices[categoryName] || [];

        lastChangedServices.forEach(serviceName => {
            const service = globalObj._state._allDefinedServices[categoryName][serviceName];

            if(
                !service.enabled
                && _elContains(globalObj._state._enabledServices[categoryName], serviceName)
                && typeof service.onAccept === 'function'
            ){
                service.enabled = true;
                service.onAccept();
            }else if(
                service.enabled
                && !_elContains(globalObj._state._enabledServices[categoryName], serviceName)
                && typeof service.onAccept === 'function'
            ){
                service.enabled = false;
                service.onReject();
            }
        });
    });

    _loadScripts(scripts, 0);
};

/**
 * Keep track of categories enabled by default (useful when mode==OPT_OUT_MODE)
 */
export const _retrieveEnabledCategoriesAndServices = () => {
    globalObj._state._allCategoryNames.forEach(categoryName => {
        const category = globalObj._state._allDefinedCategories[categoryName];

        if(category.enabled){
            globalObj._state._defaultEnabledCategories.push(categoryName);

            const services = globalObj._state._allDefinedServices[categoryName] || {};

            for(var serviceName in services){
                globalObj._state._enabledServices[categoryName].push(serviceName);
            }
        }
    });
};