
export class ConcetrationCheckLogger {
    static debugEnabled = false;

    static debug(...args) {
        if (this.debugEnabled) this._log('debug', ...args);
    }

    static info(...args) {
        this._log('log', ...args);
    }

    static warn(...args) {
        this._log('warn', ...args);
    }

    static error(...args) {
        this._log('error', ...args);
    }

    static _log(level, ...args) {
        let message = args[0];
        let otherArgs = args.slice(1);

        console[level]('concentration-check | ' + message, ...otherArgs)
    }
}
