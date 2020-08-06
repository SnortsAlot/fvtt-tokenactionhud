import * as settings from './settings.js';
import { HandlersManager } from './handlersManager.js';
import { TagDialog } from './tagDialog.js';

export class TokenActionHUD extends Application {
    i18n = (toTranslate) => game.i18n.localize(toTranslate);

    constructor(actions, rollHandler, filterManager) {
        super();
        this.refresh_timeout = null;
        this.tokens = null;
        this.actions = actions;
        this.rollHandler = rollHandler;
        this.filterManager = filterManager;
        this.rendering = false;
        this.categoryHovered = '';
    }

    updateSettings() {
        this.updateRollHandler();
        this.update();
    }

    updateRollHandler() {
        let handlerId = settings.get('rollHandler');
        let system = game.data.system.id;
        this.rollHandler = HandlersManager.getRollHandler(system, handlerId);
    }

    setTokensReference(tokens) {
        this.tokens = tokens;
    }
    
    showFilterDialog(categoryId) {
        TagDialog.showTagDialog(this.filterManager, categoryId);
    }

    trySetPos() {
        if (!(this.targetActions && this.targetActions.tokenId))
            return;

        if (settings.get('onTokenHover')) {           
            let token = canvas.tokens.placeables.find(t => t.data._id === this.targetActions.tokenId);
            this.setHoverPos(token);
        } else {
            this.setUserPos();
        }

        this.restoreCategoryHoverState();
        this.rendering = false;
    }

    setUserPos() {
        if(!(game.user.data.flags['token-action-hud'] && game.user.data.flags['token-action-hud'].hudPos))
            return;

        let pos = game.user.data.flags['token-action-hud'].hudPos;

        return new Promise(resolve => {
            function check() {
                let elmnt = document.getElementById('token-action-hud')
                if (elmnt) {
                    elmnt.style.bottom = null;
                    elmnt.style.top = (pos.top) + 'px';
                    elmnt.style.left = (pos.left) + 'px';
                    elmnt.style.position = 'fixed';
                    elmnt.style.zIndex = 100;
                resolve();
                } else {
                    setTimeout(check, 30);
                }
            }

            check();
        });
    }

    setHoverPos(token) { 
        return new Promise(resolve => {
            function check(token) {
                let elmnt = $('#token-action-hud');
                if (elmnt) {
                    elmnt.css('bottom', null);
                    elmnt.css('left', (token.worldTransform.tx + (((token.data.width * canvas.dimensions.size) + 55) * canvas.scene._viewPosition.scale)) + 'px');
                    elmnt.css('top', (token.worldTransform.ty + 0) + 'px');
                    elmnt.css('position', 'fixed');
                    elmnt.css('zIndex', 100);
                    resolve();
                } else {
                    setTimeout(check, 30);
                }
            }

            check(token);
        });
    }

    static path(filepath) {
        return this._modDir + filepath;
    }

    async submitFilter(categoryId, elements, isBlocklist) {
        let blocklist = parseInt(isBlocklist) === 0 ? false : true;

        this.filterManager.setFilteredElements(categoryId, elements, blocklist);
        this.update();
    }

    /** @override */
    static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
        template: '/modules/token-action-hud/templates/template.hbs',
        id: 'token-action-hud',
        classes: [],
        width: 200,
        height: 20,
        left: 150,
        top: 80,
        scale: 1,
        popOut: false,
        minimizable: false,
        resizable: false,
        title: 'token-action-hud',
        dragDrop: [],
        tabs: [],
        scrollY: []
        });
    }

    /** @override */
    getData(options = {}) {
        let hovering = settings.get('onTokenHover');
        const data = super.getData();
        data.actions = this.targetActions;
        data.id = 'token-action-hud';
        data.hovering = hovering;
        settings.Logger.debug('HUD data:', data);
        return data;
    }

    /** @override */
    activateListeners(html) {
        const tokenactionhud = '#token-action-hud';
        const repositionIcon = '#tah-reposition';
        const action = '.tah-action';   

        const handleClick = e => {
            let target = e.target;

            if (target.tagName !== 'BUTTON')
                target = e.currentTarget.children[0];

            let value = target.value;
            try {
                this.rollHandler.handleActionEvent(e, value);
            } catch (error) {
                settings.Logger.error(e);
            }
        }

        html.find(action).on('click', e => {
            handleClick(e);
        });

        html.find(action).contextmenu(e => {
            handleClick(e);
        });

        html.find('.tah-title-button').contextmenu('click', e => {
            let target = e.target;
            if(target.value.length > 0)
                game.tokenActionHUD.showFilterDialog(target.value);
        });

        html.find('.tah-category').hover(
            // mouseenter    
            function() {
                let category = $(this)[0];
                $(category).addClass('hover');
                let id = category.id;
                game.tokenActionHUD.setHoveredCategory(id);
                game.tokenActionHUD.resizeHoveredCategory(id);
            },
            // mouseleave
            function() {
                if (game.tokenActionHUD.rendering)
                    return;
                let category = $(this)[0];
                $(category).removeClass('hover');
                let id = category.id;
                game.tokenActionHUD.clearHoveredCategory(id);
            }
        );

        html.find(repositionIcon).mousedown(ev => {
            ev.preventDefault();
            ev = ev || window.event;

            let hud = $(document.body).find(tokenactionhud);
            let marginLeft = parseInt(hud.css('marginLeft').replace('px', ''));
            let marginTop = parseInt(hud.css('marginTop').replace('px', ''));

            dragElement(document.getElementById('token-action-hud'));
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
            function dragElement(elmnt) {
                elmnt.onmousedown = dragMouseDown;

                function dragMouseDown(e) {
                    e = e || window.event;
                    e.preventDefault();
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    
                    document.onmouseup = closeDragElement;
                    document.onmousemove = elementDrag;
                }
            
                function elementDrag(e) {
                    e = e || window.event;
                    e.preventDefault();
                    // calculate the new cursor position:
                    pos1 = pos3 - e.clientX;
                    pos2 = pos4 - e.clientY;
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    // set the element's new position:
                    elmnt.style.top = (elmnt.offsetTop - pos2) - marginTop + 'px';
                    elmnt.style.left = (elmnt.offsetLeft - pos1) - marginLeft + 'px';
                    elmnt.style.position = 'fixed';
                    elmnt.style.zIndex = 100;
                }
            
                function closeDragElement() {
                    // stop moving when mouse button is released:
                    elmnt.onmousedown = null;
                    document.onmouseup = null;
                    document.onmousemove = null;
                    let xPos = (elmnt.offsetLeft - pos1) > window.innerWidth ? window.innerWidth : (elmnt.offsetLeft - pos1);
                    let yPos = (elmnt.offsetTop - pos2) > window.innerHeight-20 ? window.innerHeight-100 : (elmnt.offsetTop - pos2)
                    xPos = xPos < 0 ? 0 : xPos
                    yPos = yPos < 0 ? 0 : yPos
                    if(xPos != (elmnt.offsetLeft - pos1) || yPos != (elmnt.offsetTop - pos2)){
                        elmnt.style.top = (yPos) + 'px';
                        elmnt.style.left = (xPos) + 'px';
                    }
                    settings.Logger.info(`Setting position to x: ${xPos}px, y: ${yPos}px, and saving in user flags.`)
                    game.user.update({flags: {'token-action-hud':{ hudPos: {top: yPos, left: xPos}}}})
                }
            }
        });
    }

    setHoveredCategory(catId) {
        this.categoryHovered = catId;
    }

    clearHoveredCategory(catId) {            
        if (this.categoryHovered === catId)
            this.categoryHovered = '';
    }

    restoreCategoryHoverState() {
        if (this.categoryHovered === '')
            return;

        let id = `#${this.categoryHovered}`
        let category = $(id);
        
        if (!category[0])
            return;

        category.mouseenter();
    }

    resizeHoveredCategory(catId) {
        let id = `#${catId}`
        let category = $(id);
        
        if (!category[0])
            return;        
        
        let content = category.find('.tah-content');
        let isOneLineFit = category.hasClass('oneLine');
        let actions = category.find('.tah-actions');
        
        if (actions.length === 0)
            return;
        
        // reset content to original width
        let contentDefaultWidth = 300;
        let minPossibleWidth = 200;
        this.resizeActions(actions, contentDefaultWidth);

        let changeStep = 30;
        
        let bottomLimit = $(document).find('#hotbar').offset().top - 20;
        let rightLimit = $(document).find('#sidebar').offset().left - 20;

        let maxRequiredWidth = this.calculateMaxRequiredWidth(actions);
        while (this.shouldIncreaseWidth(content, actions, maxRequiredWidth, bottomLimit, rightLimit, isOneLineFit)) {
            let actionRect = actions[0].getBoundingClientRect();
            let actionWidth = actionRect.width;
            
            let newWidth = actionWidth + changeStep;
            
            this.resizeActions(actions, newWidth);          
        }

        while (this.shouldShrinkWidth(content, actions, minPossibleWidth, bottomLimit, rightLimit, isOneLineFit)) {
            let actionRect = actions[0].getBoundingClientRect();
            let actionWidth = actionRect.width;

            if (actionWidth < minPossibleWidth)
                return;

            let newWidth = actionWidth - changeStep;
            
            this.resizeActions(actions, newWidth); 
        }
    }

    calculateMaxRequiredWidth(actions) {
        let maxWidth = 0;

        actions.each(function() {
            let totalWidth = 0;
            Array.from($(this).children()).forEach(c => {
                let child = $(c);
                let childWidth = child.width();
                let marginWidth = parseInt(child.css('marginLeft')) + parseInt(child.css('marginRight'));
                
                totalWidth += childWidth + marginWidth;
            });

            if (totalWidth > maxWidth)
                maxWidth = totalWidth;
        });

        return maxWidth;
    }

    shouldIncreaseWidth(content, actions, maxRequiredWidth, bottomLimit, rightLimit, isOneLineFit) {
        let contentRect = content[0].getBoundingClientRect();
        let actionsRect = actions[0].getBoundingClientRect();

        if (actionsRect.right >= rightLimit)
            return false;

        if (actionsRect.width >= maxRequiredWidth)
            return false;

        let actionArray = Array.from(content.find('.tah-action')).sort((a, b) => $(a).offset().top - $(b).offset().top);
        let rows = this.calculateRows(actionArray);
        let columns = this.calculateMaxRowButtons(actionArray);
        if (contentRect.bottom <= bottomLimit && columns >= rows && !isOneLineFit)
            return false;
        
        return true;
    }

    shouldShrinkWidth(content, actions, actionsMinWidth, bottomLimit, rightLimit, isOneLineFit) {
        let contentRect = content[0].getBoundingClientRect();
        let actionsRect = actions[0].getBoundingClientRect();

        if (contentRect.bottom >= bottomLimit)
            return false;

        if (actionsRect.width <= actionsMinWidth)
            return false;

        let actionArray = Array.from(content.find('.tah-action')).sort((a, b) => $(a).offset().top - $(b).offset().top);
        let rows = this.calculateRows(actionArray);
        let columns = this.calculateMaxRowButtons(actionArray);

        if (actionsRect.right <= rightLimit && (rows >= columns - 1 || isOneLineFit))
            return false;

        return true;
    }

    calculateRows(actionArray) {
        var rows = 0;
        let currentTopOffset = 0;
        let closeRange = 5;

        actionArray.forEach(a => {
            let offset = $(a).offset().top

            if (Math.abs(currentTopOffset - offset) >= closeRange) {
                rows++;
                currentTopOffset = offset;
            }
        });

        return rows;
    }

    calculateMaxRowButtons(actionArray) {
        if (actionArray.length < 2)
            return actionArray.length;

        var rowButtons = [];
        let currentTopOffset = 0;
        let rowButtonCounter = 0;
        let closeRange = 5;

        actionArray.forEach(a => {
            let offset = $(a).offset().top;

            if (Math.abs(currentTopOffset - offset) >= closeRange) {
                if (rowButtonCounter >= 1)
                    rowButtons.push(rowButtonCounter);

                currentTopOffset = offset;
                rowButtonCounter = 1;
            } else {
                rowButtonCounter++;
            }

            // if it's the final object, add counter anyway in case it was missed.
            if (rowButtonCounter >= 1 && actionArray.indexOf(a) === actionArray.length - 1)
                rowButtons.push(rowButtonCounter);
        });

        return Math.max(...rowButtons);
    }

    resizeActions(actions, newWidth) {
        // resize each action with new width
        actions.map(function() {
            $(this).css({"width": newWidth + 'px',
            "min-width" : newWidth + 'px'});
        })
    }

    resetPosition() {
        settings.Logger.info(`Resetting HUD position to x: 80px, y: 150px, and saving in user flags. \nIf HUD is still not visible, something else may be wrong.\nFeel free to contact ^ and stick#0520 on Discord`)
        game.user.update({flags: {'token-action-hud': {hudPos: { top: 80, left: 150 }}}})
        this.update();
    }

    update() {
        // Delay refresh because switching tokens could cause a controlToken(false) then controlToken(true) very fast
        if (this.refresh_timeout)
            clearTimeout(this.refresh_timeout)
        this.refresh_timeout = setTimeout(this.updateHud.bind(this), 100)
    }

    showHudEnabled() {
        settings.Logger.debug('showHudEnabled()', `isGM: ${game.user.isGM}`, `enabledForUser: ${settings.get('enabledForUser')}`, `playerPermission: ${settings.get('playerPermission')}`);

        if (!settings.get('enabledForUser'))            
            return false;

        return (settings.get('playerPermission') || game.user.isGM);
    }

    async updateHud() {
        settings.Logger.debug('Updating HUD');

        let token = this._getTargetToken(this.tokens?.controlled);

        this.targetActions = await this.actions.buildActionList(token);

        if (!this.showHudEnabled()) {
            this.close();
            return;
        }

        this.rendering = true;
        this.render(true);
    }

    // Really just checks if only one token is being controlled. Not smart.
    validTokenChange() {
        let controlled = this.tokens?.controlled;

        return (controlled?.length === 1 && controlled[0]) || controlled?.length === 0;
    }

    // Is something being hovered on, is the setting on, and is it the token you're currently selecting.
    validTokenHover(token, hovered) {
        return hovered && settings.get('onTokenHover') && token._id === this.targetActions?.tokenId;
    }

    // Basically update any time. All this logic could be improved.
    validActorOrItemUpdate(actor) {
        settings.Logger.debug(`actor change, comparing actors`);
        settings.Logger.debug(`actor._id: ${actor._id}; this.targetActions.actorId: ${this.targetActions?.actorId}`);

        if (!actor) {
            settings.Logger.debug('No actor, possibly deleted, should update HUD.');
            return true;
        }
            
        if (this.targetActions && actor._id === this.targetActions.actorId) {
            settings.Logger.debug('Same actor IDs, should update HUD.');
            return true;
        }

        settings.Logger.debug('Different actor, no need to update HUD.');
        return false;
    }

    isLinkedCompendium(compendiumKey) {
        settings.Logger.debug('Compendium hook triggered. Checking if compendium is linked.')
        return this.actions.isLinkedCompendium(compendiumKey);
    }

    /** @private */
    _getTargetToken(controlled) {
        if (controlled.length > 1)
            return null;

        if (controlled.length === 0 && canvas.tokens?.placeables) {
            if (!settings.get('alwaysShowHud'))
                return null;
            
            let character = game.user.character;
            let token = canvas.tokens.placeables.find(t => t.actor._id === character._id)
            if (token)
                return token;
            
            return null;
        }

        let ct = controlled[0];

        if (!ct)
            return null;

        if(this._userHasPermission(ct))
            return ct;
            
        return null;
    }

    /** @private */
    _userHasPermission(token = '') {
        let actor = token.actor;
        let user = game.user;
        return game.user.isGM || actor.hasPerm(user, "OWNER");
    }
}