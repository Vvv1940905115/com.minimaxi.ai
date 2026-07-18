// resolve_bridge.js
// Handles communication with the local Python server for DaVinci Resolve

const RESOLVE_API_URL = "http://localhost:8085";

async function sendToResolve(action, data) {
    try {
        const response = await fetch(`${RESOLVE_API_URL}/${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const json = await response.json();
        return json;
    } catch (e) {
        console.error("Resolve Bridge Error:", e);
        return { success: false, message: e.message };
    }
}

window.ResolveBridge = {
    importAudio: async (filePath) => {
        return await sendToResolve('import_audio', { path: filePath });
    }
};
