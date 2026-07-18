// Host Script for AE/PPro (Functions Only - Loading handled by Client)

// Helper for Recursive Search (PPro)
function findItemRecursive(folder, name) {
    if (!folder) return null;
    var children = folder.children;
    if (!children) return null;
    for (var i = 0; i < children.numItems; i++) {
        var item = children[i];
        if (item.name === name) {
            return item;
        }
        if (item.type === ProjectItemType.BIN) {
            var found = findItemRecursive(item, name);
            if (found) return found;
        }
    }
    return null;
}

function importAndOrganize(filePath) {
    try {
        var project = app.project;
        if (!project) return "Error: No project open";
        var targetFolderName = "Aivoice";

        // Premiere Pro Logic
        if (BridgeTalk.appName == "premierepro") {
            if (!app.project) return "Error: No project open";

            // Find or Create "Aivoice" Bin
            var targetBin = findItemRecursive(app.project.rootItem, targetFolderName);
            if (!targetBin) {
                targetBin = app.project.rootItem.createBin(targetFolderName);
            }

            // Import into that bin
            var success = app.project.importFiles([filePath], true, targetBin, false);
            if (success) {
                var f = new File(filePath);
                // CRITICAL FIX: Return decoded name so client gets "こんにちは.wav" not "%E3%..."
                var decodedName = f.displayName;
                if (!decodedName) decodedName = decodeURI(f.name);
                return "Success: " + decodedName;
            } else {
                return "Error: PPro Import Failed";
            }
        }

        // After Effects Logic
        var file = new File(filePath);
        if (!file.exists) return "Error: File does not exist: " + filePath;

        var importOptions = new ImportOptions();
        importOptions.file = file;

        var importedItem = app.project.importFile(importOptions);

        var aiFolder = null;
        for (var i = 1; i <= app.project.rootFolder.numItems; i++) {
            var item = app.project.rootFolder.item(i);
            if (item instanceof FolderItem && item.name === targetFolderName) {
                aiFolder = item;
                break;
            }
        }

        if (!aiFolder) {
            aiFolder = app.project.items.addFolder(targetFolderName);
        }

        importedItem.parentFolder = aiFolder;

        var prefix = "AI_";
        var maxNum = 0;
        for (var j = 1; j <= aiFolder.numItems; j++) {
            var item = aiFolder.item(j);
            if (item.id !== importedItem.id && item.name.indexOf(prefix) === 0) {
                var parts = item.name.split("_");
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
        importedItem.name = prefix + padNum;

        // Return ID for safer lookup in AE
        return "SuccessID: " + importedItem.id;

    } catch (e) {
        return "Error: " + e.toString();
    }
}

function addItemToComp(identifier) {
    try {
        if (BridgeTalk.appName == "premierepro") {
            var seq = app.project.activeSequence;
            if (!seq) return "Error: No active sequence (Open a timeline)";

            // Check Audio Tracks
            if (!seq.audioTracks || seq.audioTracks.numTracks === 0) {
                return "Error: Active sequence has no audio tracks.";
            }

            // CRITICAL FIX: Ensure we search for decoded name
            var name = decodeURI(identifier);

            // PPro Recursive Search: Find the item anywhere
            var item = findItemRecursive(app.project.rootItem, name);

            if (!item) return "Error: Item not found in PPro project: " + name + " (Raw: " + identifier + ")";

            var time = seq.getPlayerPosition();
            var track = seq.audioTracks[0];
            var startTicks = time.ticks;

            // Insert Clip
            var inserted = track.insertClip(item, time);

            // --- CTI ADVANCEMENT LOGIC ---
            // 1. Try to use returned object (newer APIs)
            var targetClip = inserted;

            // 2. Fallback: Search for clip starting at insertion time (older APIs or sync issues)
            if (!targetClip) {
                for (var k = 0; k < track.clips.numItems; k++) {
                    var c = track.clips[k];
                    if (c && c.start && c.start.ticks === startTicks) {
                        targetClip = c;
                        break;
                    }
                }
            }

            // 3. Move Playhead if clip found
            if (targetClip && targetClip.end) {
                seq.setPlayerPosition(targetClip.end.ticks);
            }

            return "Success";
        }

        // After Effects Logic
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return "Error: No active composition found. Please open a Composition.";

        var item = null;

        // Check if identifier is ID (digits)
        var id = parseInt(identifier, 10);

        if (!isNaN(id)) {
            // Search by ID
            for (var i = 1; i <= app.project.numItems; i++) {
                if (app.project.item(i).id === id) {
                    item = app.project.item(i);
                    break;
                }
            }
        }

        // Fallback: Name search
        if (!item) {
            var searchName = decodeURI(identifier);
            for (var i = 1; i <= app.project.numItems; i++) {
                if (app.project.item(i).name === searchName) {
                    item = app.project.item(i);
                    break;
                }
            }
        }

        if (!item) return "Error: Item not found in project. ID/Name: " + identifier;

        var layer = comp.layers.add(item);
        layer.startTime = comp.time;

        // NEW: Advance Playhead (Current Time) in AE
        // In AE, setting comp.time works directly.
        if (item.duration) {
            comp.time += item.duration;
        }

        return "Success";
    } catch (e) {
        return "Error: " + e.toString();
    }
}

// ALIAS for Compatibility
function addItemToSequence(filePath) {
    return addItemToComp(filePath);
}
function renderActiveFrame(outputPath) { return "Error: Not Implemented"; }
