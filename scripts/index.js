
Hooks.on('ready', function() {
    Hooks.on('updateActor', function(document, changes) {
        if (document.type !== 'character') {
            return;
        }

        let isConcentrating = !!document.effects.find(v => v.flags?.core?.statusId === 'concentration');
        if (!isConcentrating) {
            return;
        }

        let name = document.name;
        let newHp = changes.system?.attributes?.hp?.value;

        if (newHp) {
            ChatMessage.create({
                content: "Roll for Concentration."
            });
        }
    });
});
