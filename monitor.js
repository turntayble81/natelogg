class Monitor {
    constructor(params) {
        Object.assign(this, params);
    }

    destroy() {
        this.watchers.forEach((watcher) => (watcher.tail.unwatch()));
    }

    isReset() {
        return this.resetCount > this.resetCountThreshold;
    }
}

module.exports = Monitor;
