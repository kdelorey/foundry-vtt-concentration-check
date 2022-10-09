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
        Hooks.once('ready', cc._onReady.bind(cc));

        return cc;
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

    _onActorUpdated(document, changes, diff) {
        if (!this.isLeader) {
            return;
        }

        if (document.type !== 'character') {
            return;
        }

        let isConcentrating = !!document.effects.find(v => v.flags?.core?.statusId === 'concentration');
        if (!isConcentrating) {
            return;
        }

        let hpDelta = diff.dhp;

        if (hpDelta && hpDelta < 0) {
            ChatMessage.create({
                content: "Ouch! Roll to maintain concentration!"
            });
        }
    }
}

ConcentrationCheck.start();
