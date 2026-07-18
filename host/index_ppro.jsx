function importAndOrganize(filePath) {
    try {
        var project = app.project;
        if (!project) return "Error: No project open";

        // 1. Import File
        // PPro importFles(filePaths, suppressUI, targetBin, importAsNumberedStills)
        // returns boolean
        var imported = project.importFiles([filePath], true, project.rootItem, false);
        if (!imported) return "Error: Import failed";

        // 2. Find or Create "AI_GENERATED" Bin
        var aiBin = null;
        var rootItem = project.rootItem;
        for (var i = 0; i < rootItem.children.numItems; i++) {
            var item = rootItem.children[i];
            if (item.type === ProjectItemType.BIN && item.name === "AI_GENERATED") {
                aiBin = item;
                break;
            }
        }

        if (!aiBin) {
            aiBin = project.rootItem.createBin("AI_GENERATED");
        }

        // 3. Move imported item to Bin and Rename
        // Note: importFiles returns true/false, not the item itself in older APIs, 
        // but usually the imported item is the last one in root or selected.
        // A safer way is to search for the file path.

        var targetItem = null;
        // Search in root first (where it was imported)
        for (var i = 0; i < rootItem.children.numItems; i++) {
            var item = rootItem.children[i];
            if (item.type === ProjectItemType.CLIP && item.getMediaPath() && item.getMediaPath().replace(/\\/g, '/') === filePath.replace(/\\/g, '/')) {
                targetItem = item;
                break;
            }
        }

        if (targetItem) {
            targetItem.moveBin(aiBin);

            // Rename logic (AI_001, etc.)
            var prefix = "AI_";
            var maxNum = 0;
            for (var j = 0; j < aiBin.children.numItems; j++) {
                var binItem = aiBin.children[j];
                if (binItem.name.indexOf(prefix) === 0) {
                    var parts = binItem.name.split("_");
                    if (parts.length > 1) {
                        var numPart = parseInt(parts[1], 10);
                        if (!isNaN(numPart) && numPart > maxNum) {
                            maxNum = numPart;
                        }
                    }
                }
            }
            var nextNum = maxNum + 1;
            var padNum = ("000" + nextNum).slice(-3);
            targetItem.name = prefix + padNum;

            return "Success: " + targetItem.name; // Return name for next step
        }

        return "Success: Imported (Rename failed)";

    } catch (e) {
        return "Error: " + e.toString();
    }
}

function addItemToSequence(fileName) {
    try {
        var project = app.project;
        var sequence = project.activeSequence;
        if (!sequence) return "Error: No active sequence";

        // Find the item in AI_GENERATED bin by name
        var targetItem = null;
        var aiBin = null;
        var rootItem = project.rootItem;

        // Find bin first
        for (var i = 0; i < rootItem.children.numItems; i++) {
            var item = rootItem.children[i];
            if (item.type === ProjectItemType.BIN && item.name === "AI_GENERATED") {
                aiBin = item;
                break;
            }
        }

        if (!aiBin) return "Error: AI_GENERATED bin not found";

        // Find item in bin
        for (var j = 0; j < aiBin.children.numItems; j++) {
            var binItem = aiBin.children[j];
            if (binItem.name === fileName) {
                targetItem = binItem;
                break;
            }
        }

        if (!targetItem) return "Error: Item " + fileName + " not found in bin";

        // Insert into first available audio track
        var audioTracks = sequence.audioTracks;
        var time = sequence.getPlayerPosition(); // Current CTI position

        // Simple insert to Track 1
        if (audioTracks.numTracks > 0) {
            audioTracks[0].insertClip(targetItem, time);
            return "Success";
        } else {
            return "Error: No audio tracks available";
        }

    } catch (e) {
        return "Error: " + e.toString();
    }
}
