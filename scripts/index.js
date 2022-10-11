import { ConcetrationCheckLogger as Log } from './log.js';

class ConcentrationCheckSocket {
    static NAME = 'module.concentration-check';

    static I_AM_LEADER = 'i-am-leader';

    static async emit(type, payload) {
        let msg = { 
            type: type,
            source: game.users.current.id,
            payload: payload
        };

        await new Promise(resolve => {
            game.socket.emit(ConcentrationCheckSocket.NAME, msg, () => resolve());
        });

        Log.debug('emitted socket event', msg);
    }

    static isFromSelf(event) {
        if (typeof event === 'string') {
            return event === game.current.id;
        }

        // undetermined, assume self
        if (!event.source) {
            return true;
        }

        return event.source === game.users.current.id;
    }
}

class ConcentrationCheck {
    /**
     * Whether the concentration messages are produce by this script.
     */
    isLeader = false;

    static start() {
        let cc = new ConcentrationCheck();
        
        Log.debug('starting concentration check');
        Hooks.once('init', cc._onInit.bind(cc));
        Hooks.once('ready', cc._onReady.bind(cc));

        return cc;
    }

    _onInit() {
        Hooks.on('renderChatMessage', this._onRenderChatMessage.bind(this));
    }

    async _onReady() {
        Log.debug('game ready');

        // Only GMs are allowed to run this script.
        if (!game.users.current?.isGM) {
            Log.info('user is not a GM; nothing to do');
            return;
        }

        game.socket.on(ConcentrationCheckSocket.NAME, this._onSocketMessage.bind(this));

        // inform any other GM that `this` is taking over as leader.
        ConcentrationCheckSocket.emit(ConcentrationCheckSocket.I_AM_LEADER);
        this.isLeader = true;
        this._hookUpdateActor();
    }

    _onSocketMessage(event) {
        if (ConcentrationCheckSocket.isFromSelf(event)) {
            return;
        }

        Log.debug('received socket message', event);

        switch (event.type) {
            case ConcentrationCheckSocket.I_AM_LEADER:
                Log.info('new GM leader elected');
                this.isLeader = false;
                break;
        }
    }

    _hookUpdateActor() {
        let id = Hooks.on('updateActor', this._onActorUpdated.bind(this));
        Log.debug('hooked actor update', id);
    }

    async _onActorUpdated(actor, changes, diff) {
        if (!this.isLeader) {
            return;
        }

        if (actor.type !== 'character') {
            return;
        }

        let isConcentrating = !!actor.effects.find(v => v.flags?.core?.statusId === 'concentration');
        if (!isConcentrating) {
            return;
        }

        if (diff.dhp < 0) {
            let requestData = {
                actorId: actor.id,
                tokenName: actor.name
            };

            let chatData = {
                content: await renderTemplate("./modules/concentration-check/templates/concentration-message.html", requestData)
            };
            
            setProperty(chatData, 'flags.concentration-check', requestData);

            ChatMessage.create(chatData);
        }
    }

    async _onRenderChatMessage(message, html, data) {
        const card = html.find('.concentration-check.chat-card');
        if (card.length <= 0) {
            return;
        }

        Log.debug('rendering chat message', message);

        let actorId = message.getFlag('concentration-check', 'actorId');
        let actor = game.actors.get(actorId);
        if (!actor) {
            Log.warn('intended actor receipient not found', actorId);
            return;
        }

        // If we are re-rendering (say after a refresh), check to see if a value was already 
        // rolled and if so, show its value instead of the "roll" button.
        let existingRollValue = message.getFlag('concentration-check', 'rollValue');
        if (!!existingRollValue) {
            html.find('.roll-saving-throw').remove();
            return;
        }

        // Only allow people with ownership of the actor to roll the saving throw. Everyone
        // else will just see the message without the "roll" button.
        if (actor.ownership[game.user.id] !== foundry.CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
            Log.debug('message is intended for another user; hiding roll capability...', actor, game.user.id);
            html.find('.only-actor-owner').remove();
            return;
        }

        $('.roll-saving-throw', html).click($.proxy(function() {
            Log.debug('clicked saving throw')
            html.find('.roll-saving-throw').remove();
            message.setFlag('concentration-check', 'rollValue', 20);
        }))
    }
}

ConcentrationCheck.start();
